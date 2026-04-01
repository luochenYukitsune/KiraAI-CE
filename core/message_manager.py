"""
Message Manager Module.

This module provides the MessageProcessor class for handling all message
processing logic, including message buffering, LLM interaction, and
response generation.
"""

import asyncio
import time
from asyncio import Lock
import xml.etree.ElementTree as ET
from typing import Union, Any, List, Optional
from pathlib import Path
from asyncio import Semaphore
import random
import os

from core.logging_manager import get_logger
from core.utils.common_utils import image_to_base64
from core.utils.path_utils import get_data_path
from core.chat.message_utils import KiraMessageEvent, KiraMessageBatchEvent,  KiraCommentEvent, MessageChain
from core.chat.message_utils import KiraIMSentResult, KiraStepResult
from core.prompt_manager import Prompt

from core.chat.message_elements import (
    BaseMessageElement,
    Text,
    Image,
    At,
    Reply,
    Forward,
    Emoji,
    Sticker,
    Record,
    Notice,
    Poke,
    File,
    Video
)

from core.llm_client import LLMClient
from core.chat.session_manager import SessionManager
from .prompt_manager import PromptManager
from .adapter import AdapterManager
from .provider import ProviderManager, LLMRequest, LLMResponse
from core.plugin.plugin_handlers import event_handler_reg, EventType
from core.agent.agent_executor import AgentExecutor, AgentExecutionContext, NewMemory
from core.agent.tool import ToolSet
from core.tag import tag_registry, TagSet

logger = get_logger("message", "cyan")
llm_logger = get_logger("llm", "purple")


class SessionBuffer:
    """
    Buffer for collecting messages within a session before processing.

    Attributes:
        buffer: List of buffered messages.
        lock: Asyncio lock for thread-safe operations.
        max_count: Maximum number of messages to buffer.
    """

    def __init__(self, max_count: int = None):
        self.buffer: list = []
        self.lock: asyncio.Lock = asyncio.Lock()
        self.max_count = max_count

    def add(self, message: KiraMessageEvent):
        self.buffer.append(message)

    def pop(self, count: int = 1):
        if self.get_length() < count:
            popped = self.buffer[:]
            self.buffer.clear()
            return popped
        popped = self.buffer[:count]
        del self.buffer[:count]
        return popped

    def flush(self, count: int = None):
        if count and count <= len(self.buffer):
            pending_messages = self.buffer[:count]
            del self.buffer[:count]
        else:
            pending_messages = self.buffer[:]
            self.buffer.clear()
        return pending_messages

    def get_length(self):
        return len(self.buffer)

    def get_buffer_lock(self) -> Lock:
        """get buffer lock"""
        return self.lock


class SessionBufferManager:
    """
    Manager for session-specific message buffers.

    Attributes:
        buffers: Dictionary mapping session IDs to SessionBuffer instances.
        max_count: Maximum messages per buffer.
    """

    def __init__(self, max_count: int = None):
        self.buffers: dict[str, SessionBuffer] = {}
        self.max_count = max_count

    def get_buffer(self, session: str):
        if session not in self.buffers:
            self.buffers[session] = SessionBuffer(self.max_count)
        return self.buffers[session]


class MessageProcessor:
    """
    Core message processor for handling all message sending and receiving logic.

    This class coordinates message buffering, LLM interaction, tool execution,
    and response generation. It manages the complete message processing pipeline.

    Attributes:
        kira_config: KiraConfig instance with application settings.
        bot_config: Bot-specific configuration.
        max_message_interval: Maximum interval for message buffering.
        max_buffer_messages: Maximum messages to buffer per session.
        min_message_delay: Minimum delay between sent messages.
        max_message_delay: Maximum delay between sent messages.
        llm_api: LLMClient instance for LLM interactions.
        message_processing_semaphore: Semaphore for concurrent message handling.
        memory_manager: SessionManager for conversation history.
        prompt_manager: PromptManager for generating prompts.
        provider_mgr: ProviderManager for model access.
        adapter_mgr: AdapterManager for platform adapters.
        session_locks: Dictionary of per-session locks.
        session_buffer: SessionBufferManager for message buffering.
    """

    def __init__(self,
                 kira_config,
                 llm_api: LLMClient,
                 provider_manager: ProviderManager,
                 adapter_manager: AdapterManager,
                 memory_manager: SessionManager,
                 prompt_manager: PromptManager,
                 max_concurrent_messages: int = 3):
        self.kira_config = kira_config
        self.bot_config = kira_config["bot_config"].get("bot")
        self.max_message_interval = float(self.bot_config.get("max_message_interval"))
        self.max_buffer_messages = int(self.bot_config.get("max_buffer_messages"))
        self.min_message_delay = float(self.bot_config.get("min_message_delay", "0.8"))
        self.max_message_delay = float(self.bot_config.get("max_message_delay", "1.5"))

        self.llm_api = llm_api

        self.message_processing_semaphore = Semaphore(max_concurrent_messages)

        # managers
        self.memory_manager = memory_manager
        self.prompt_manager = prompt_manager
        self.provider_mgr = provider_manager
        self.adapter_mgr = adapter_manager

        # message buffer
        self.session_locks: dict[str, asyncio.Lock] = {}

        self.session_buffer = SessionBufferManager(max_count=self.max_buffer_messages)

        logger.info("MessageProcessor initialized")

    def get_session_lock(self, sid: str) -> Lock:
        """get session lock to avoid sending message simultaneously"""
        if sid not in self.session_locks:
            self.session_locks[sid] = asyncio.Lock()
        return self.session_locks[sid]

    def get_session_list_prompt(self) -> str:
        session_list_prompt = ""
        _chat_memory = self.memory_manager.chat_memory
        for session_id in _chat_memory:
            session_list_prompt += f"{session_id}\n"
        return session_list_prompt

    def get_session_buffer_length(self, sid: str) -> int:
        buffer = self.session_buffer.get_buffer(sid)
        return buffer.get_length()

    async def pop_session_messages(self, sid: str, count: int = 1):
        buffer = self.session_buffer.get_buffer(sid)
        buffer.pop(count)

    async def flush_session_messages(self, sid: str, extra_event: KiraMessageEvent | None = None) -> bool:
        buffer = self.session_buffer.get_buffer(sid)
        async with buffer.lock:
            if extra_event is not None:
                buffer.add(extra_event)
            pending_messages: list[KiraMessageEvent] = buffer.flush()
        if not pending_messages:
            return False
        last_event = pending_messages[-1]
        batch_msg = KiraMessageBatchEvent(
            message_types=last_event.message_types,
            timestamp=int(time.time()),
            adapter=last_event.adapter,
            session=last_event.session,
            messages=[m.message for m in pending_messages]
        )
        await self.handle_im_batch_message(batch_msg)
        return True

    async def message_format_to_text(self, message_chain: MessageChain):
        """将平台使用标准消息格式封装的消息转换为LLM可以接收的字符串"""
        message_str = ""
        for ele in message_chain:
            if isinstance(ele, Text):
                message_str += ele.text
            elif isinstance(ele, Emoji):
                if ele.emoji_desc:
                    message_str += f"[Emoji {ele.emoji_desc} (ID: {ele.emoji_id})]"
                else:
                    message_str += f"[Emoji {ele.emoji_id}]"
            elif isinstance(ele, At):
                if ele.nickname:
                    message_str += f"[At {ele.pid}(nickname: {ele.nickname})]"
                else:
                    message_str += f"[At {ele.pid}]"
            elif isinstance(ele, Image):
                image_base64 = await ele.to_base64()
                img_desc = await self.llm_api.desc_img(image_base64, is_base64=True)
                ele.caption = img_desc
                message_str += f"[Image {img_desc}]"
            elif isinstance(ele, Sticker):
                sticker_base64 = await ele.to_base64()
                sticker_desc = await self.llm_api.desc_img(sticker_base64, is_base64=True)
                ele.caption = sticker_desc
                message_str += f"[Sticker {sticker_desc}]"
            elif isinstance(ele, Reply):
                if ele.chain:
                    ele.chain.message_list = [x for x in ele.chain if not isinstance(x, Reply)]
                    reply_content = await self.message_format_to_text(ele.chain)
                    message_str += f"[Reply ID: {ele.message_id} content: {reply_content}]"
                elif ele.message_content:
                    message_str += f"[Reply ID: {ele.message_id} content: {ele.message_content}]"
                else:
                    message_str += f"[Reply ID: {ele.message_id}]"
            elif isinstance(ele, Forward):
                if ele.chains:
                    forward_contents = ""
                    for i, chain in enumerate(ele.chains):
                        ele.chains[i].message_list = [x for x in chain if not isinstance(x, Forward)]
                        forward_content = await self.message_format_to_text(ele.chains[i])
                        forward_contents += f"\n{forward_content}\n"
                    message_str += f"[Forward {forward_contents.strip()}]"
            elif isinstance(ele, Record):
                record_text = await self.llm_api.speech_to_text(record=ele)
                ele.transcript = record_text
                message_str += f"[Record {record_text}]"
            elif isinstance(ele, Notice):
                message_str += f"{ele.text}"
            elif isinstance(ele, File):
                try:
                    file_size = int(ele.size)
                except Exception as _:
                    file_size = None

                # TODO Make it customizable
                if not file_size or file_size > 10 * 1024 * 1024:
                    message_str += f"[File name: {ele.name} (File size over 10MB, not cached)]"
                    continue

                try:
                    path = Path(await ele.to_path())
                    data_dir = get_data_path()

                    try:
                        rel = path.relative_to(data_dir)
                        path_result = f"data/{rel}"
                    except ValueError:
                        path_result = str(path)

                    message_str += f"[File name: {ele.name}, file_path: {path_result}]"
                except Exception as e:
                    logger.error(f"Failed to save temp file: {e}")
            elif isinstance(ele, Video):
                try:
                    video_file_size = int(ele.size)
                except Exception as _:
                    video_file_size = None

                # TODO Make it customizable
                if not video_file_size or video_file_size > 10 * 1024 * 1024:
                    message_str += f"[Video name: {ele.name} (Video size over 10MB, not cached)]"
                    continue

                try:
                    path = Path(await ele.to_path())
                    data_dir = get_data_path()

                    try:
                        rel = path.relative_to(data_dir)
                        path_result = f"data/{rel}"
                    except ValueError:
                        path_result = str(path)

                    message_str += f"[Video name: {ele.name}, file_path: {path_result}]"
                except Exception as e:
                    logger.error(f"Failed to save temp video file: {e}")
            else:
                pass
        return message_str

    async def handle_im_message(self, event: KiraMessageEvent):
        """
        Process an incoming IM message event.

        Handles message buffering, event handlers, and triggers batch processing
        based on the event's process_strategy.

        Args:
            event: The incoming message event to process.
        """
        logger.info(event.get_log_info())

        # decorating event info
        logger.debug(f"[MessageProcessor] Step 1: Processing IM message event...")

        sid = event.session.sid

        event.session.session_description = self.memory_manager.get_session_info(sid).session_description

        # EventType.ON_IM_MESSAGE
        logger.debug(f"[MessageProcessor] Step 2: Executing ON_IM_MESSAGE handlers...")
        im_handlers = event_handler_reg.get_handlers(event_type=EventType.ON_IM_MESSAGE)
        for handler in im_handlers:
            logger.debug(f"[MessageProcessor]   -> Executing handler: {handler.desc or handler.handler.__name__}")
            await handler.exec_handler(event)
            if event.is_stopped:
                logger.debug(f"[MessageProcessor] Event stopped by handler")
                return
        if event.process_strategy == "discard":
            logger.debug(f"[MessageProcessor] Message discarded by strategy")
            return

        if event.process_strategy == "trigger":
            logger.debug(f"[MessageProcessor] Step 3: Strategy=trigger, creating batch message...")
            batch_msg = KiraMessageBatchEvent(
                message_types=event.message_types,
                timestamp=int(time.time()),
                adapter=event.adapter,
                session=event.session,
                messages=[event.message]
            )
            await self.handle_im_batch_message(batch_msg)
            return

        if event.process_strategy == "buffer":
            logger.debug(f"[MessageProcessor] Step 3: Strategy=buffer, adding message to session buffer...")
            buffer = self.session_buffer.get_buffer(sid)
            async with buffer.lock:
                buffer.add(event)

            # EventType.ON_MESSAGE_BUFFERED
            logger.debug(f"[MessageProcessor] Executing ON_MESSAGE_BUFFERED handlers...")
            im_handlers = event_handler_reg.get_handlers(event_type=EventType.ON_MESSAGE_BUFFERED)
            for handler in im_handlers:
                await handler.exec_handler(event.session.sid)
            logger.debug(f"[MessageProcessor] Message buffered, current buffer length: {buffer.get_length()}")
            return

        if event.process_strategy == "flush":
            logger.debug(f"[MessageProcessor] Step 3: Strategy=flush, flushing session buffer...")
            flushed = await self.flush_session_messages(sid, extra_event=event)
            if not flushed:
                logger.warning(f"No pending messages to flush for session {sid}")
            return

    async def handle_im_batch_message(self, event: KiraMessageBatchEvent):
        """
        Process a batch of messages from a session.

        This is the main processing pipeline that:
        1. Converts messages to text format
        2. Runs event handlers
        3. Builds chat environment and prompts
        4. Executes the agent loop
        5. Sends responses

        Args:
            event: The batch message event to process.
        """
        # Start processing
        sid = event.session.sid
        logger.debug(f"[MessageProcessor] === handle_im_batch_message START ===")
        logger.debug(f"[MessageProcessor] Session ID: {sid}")

        logger.debug(f"[MessageProcessor] Step 1: Converting messages to text format...")
        for i, message in enumerate(event.messages):
            # TODO Add support for multimodal image/document comprehension
            message_str = await self.message_format_to_text(message.chain)
            message.message_str = message_str
            logger.debug(f"[MessageProcessor]   -> Message {i+1}: {message_str[:100]}{'...' if len(message_str) > 100 else ''}")

        # EventType.ON_IM_BATCH_MESSAGE
        logger.debug(f"[MessageProcessor] Step 2: Executing ON_IM_BATCH_MESSAGE handlers...")
        im_batch_handlers = event_handler_reg.get_handlers(event_type=EventType.ON_IM_BATCH_MESSAGE)
        for handler in im_batch_handlers:
            logger.debug(f"[MessageProcessor]   -> Executing handler: {handler.desc or handler.handler.__name__}")
            await handler.exec_handler(event)
            if event.is_stopped:
                logger.info("Event stopped")
                return

        # Get existing session
        logger.debug(f"[MessageProcessor] Step 3: Getting session info and chat history...")
        session_list = self.get_session_list_prompt()

        # Set session title
        if not self.memory_manager.get_session_info(sid).session_title:
            self.memory_manager.update_session_info(sid, event.session.session_title)
        session_title = self.memory_manager.get_session_info(sid).session_title
        logger.debug(f"[MessageProcessor]   -> Session title: {session_title}")

        # Build chat environment
        logger.debug(f"[MessageProcessor] Step 4: Building chat environment...")
        chat_env = {
            "platform": event.adapter.platform,
            "adapter": event.adapter.name,
            "chat_type": 'GroupMessage' if event.is_group_message() else 'DirectMessage',
            "self_id": event.self_id,
            "session_title": session_title,
            "session_description": event.session.session_description,
            "session_list": session_list
        }
        logger.debug(f"[MessageProcessor]   -> Platform: {chat_env['platform']}, Chat type: {chat_env['chat_type']}")

        # Get chat history memory
        logger.debug(f"[MessageProcessor] Step 5: Fetching chat history memory...")
        session_memory = self.memory_manager.fetch_memory(sid)
        logger.debug(f"[MessageProcessor]   -> Memory entries: {len(session_memory)}")

        # Generate agent prompt
        logger.debug(f"[MessageProcessor] Step 6: Generating agent prompt...")
        agent_prompt_list = self.prompt_manager.get_agent_prompt(chat_env)

        # Get default LLM model client
        logger.debug(f"[MessageProcessor] Step 7: Getting default LLM model...")
        llm_model = self.provider_mgr.get_default_llm()
        if not llm_model:
            llm_logger.error(f"Default LLM model not set, please set it in Configuration")
            return
        logger.debug(f"[MessageProcessor]   -> LLM Model: {llm_model.model.model_id} (Provider: {llm_model.model.provider_name})")

        request = LLMRequest(messages=session_memory[:], tools=self.llm_api.tools_definitions, tool_funcs=self.llm_api.tools_functions, tool_set=ToolSet())
        request.system_prompt.extend(agent_prompt_list)

        # Add received im messages
        logger.debug(f"[MessageProcessor] Step 8: Building LLM request with user messages...")
        for i, message in enumerate(event.messages):
            request.user_prompt.append(Prompt(message.message_str, name="message", source="system"))

        # Build tag set
        logger.debug(f"[MessageProcessor] Step 9: Building tag set...")
        tag_set = TagSet()

        # EventType.ON_LLM_REQUEST
        logger.debug(f"[MessageProcessor] Step 10: Executing ON_LLM_REQUEST handlers...")
        llm_handlers = event_handler_reg.get_handlers(event_type=EventType.ON_LLM_REQUEST)
        for handler in llm_handlers:
            logger.debug(f"[MessageProcessor]   -> Executing handler: {handler.desc or handler.handler.__name__}")
            await handler.exec_handler(event, request, tag_set)
            if event.is_stopped:
                logger.info("Event stopped while llm request stage")
                return

        # Register persistent tags registered by user plugins
        tag_set.register(*tag_registry.get_all())

        # Assemble messages
        logger.debug(f"[MessageProcessor] Step 11: Assembling prompt messages...")
        for sp in request.system_prompt:
            if sp.name == "format":
                sp.content = sp.content.replace("<|message_types|>", tag_set.to_prompt())
                break
        request.assemble_prompt()

        # TODO: migrate tools & tool_func params to tool_set
        request.tools.extend(request.tool_set.to_list())

        # Print user message info
        user_message = "".join(p.to_string() for p in request.user_prompt if isinstance(p, Prompt))
        logger.info(f"processing message(s) from {sid}:\n{user_message}")

        # 把收到的消息放到新收到的消息内容中
        new_memory = NewMemory()
        new_memory.user(user_message)

        # Get max tool loop config, defaults to 2 if not a valid integer
        max_tool_loop = self.kira_config.get_config("bot_config.agent.max_tool_loop")
        try:
            max_tool_loop = int(max_tool_loop)
        except ValueError:
            max_tool_loop = 2

        max_agent_steps = max_tool_loop + 1
        logger.debug(f"[MessageProcessor] Step 12: Creating AgentExecutor (max_steps={max_agent_steps})...")

        agent_executor = AgentExecutor(self.llm_api, request.tool_set)
        agent_ctx = AgentExecutionContext(
            event=event,
            request=request,
            llm_model=llm_model,
            new_memory=new_memory,
        )

        async def send_llm_text(resp: LLMResponse):
            text = resp.text_response
            session_lock = self.get_session_lock(sid)
            async with session_lock:
                logger.debug(f"[MessageProcessor] Step 13: Parsing and sending LLM text response...")
                message_results = await self.send_xml_messages(event, text.strip(), tag_set)
                if message_results is None:
                    return
                response_with_ids = self._add_message_ids(text, message_results)
                step_result = KiraStepResult(message_results=message_results, raw_output=response_with_ids)
                # EventType.ON_STEP_RESULT
                step_handlers = event_handler_reg.get_handlers(event_type=EventType.ON_STEP_RESULT)
                for step_handler in step_handlers:
                    await step_handler.exec_handler(event, step_result)
                    if event.is_stopped:
                        logger.info("Event stopped while ON_STEP_RESULT stage")
                        return
                logger.info(f"LLM -> {sid}: {step_result.raw_output}")
                llm_resp.text_response = step_result.raw_output

                for idx in range(-1, -len(new_memory.memory_list), -1):
                    if new_memory.memory_list[idx]["role"] == "assistant":
                        new_memory.memory_list[idx]["content"] = step_result.raw_output
                        request.messages[idx]["content"] = step_result.raw_output
                        break

        # Iter agent executor to get LLMResponse
        # TODO use llm_semaphore to restrict concurrent LLM requests
        logger.debug(f"[MessageProcessor] Step 14: Starting Agent execution loop...")
        async for step in agent_executor.run(agent_ctx, max_steps=max_agent_steps):
            llm_resp = step.llm_response
            if not llm_resp:
                break

            if llm_resp.text_response:
                await send_llm_text(llm_resp)

            if not step.has_tool_calls or step.is_final:
                break

            # Process tool calls if existed

        # Save new memory
        logger.debug(f"[MessageProcessor] Step 15: Saving new memory to session...")
        self.memory_manager.update_memory(sid, new_memory.memory_list)
        logger.debug(f"[MessageProcessor] === handle_im_batch_message END ===")

    async def handle_cmt_message(self, msg: KiraCommentEvent):
        """process comment message"""

        if msg.sub_cmt_id:
            logger.info(f"[{msg.adapter_name} | {msg.sub_cmt_id}] [{msg.commenter_nickname}]: {msg.sub_cmt_content[0].text}")
            cmt_content = f"""You: {msg.cmt_content[0].text}
            {msg.commenter_nickname}: {msg.sub_cmt_content[0].text}
            """
        else:
            logger.info(f"[{msg.adapter_name} | {msg.cmt_id}] [{msg.commenter_nickname}]: {msg.cmt_content[0].text}")
            cmt_content = f"""{msg.commenter_nickname}: {msg.cmt_content[0].text}"""

        cmt_prompt = self.prompt_manager.get_comment_prompt(cmt_content)

        client = self.provider_mgr.get_default_llm()
        if not client:
            llm_logger.error(f"Default LLM model not set, please set it in Configuration")
            return

        llm_req = LLMRequest(messages=[{"role": "user", "content": cmt_prompt}])

        llm_resp = await client.chat(llm_req)

        response = llm_resp.text_response.strip()

        logger.info(f"LLM: {response}")

        if response:
            await self.adapter_mgr.get_adapter(msg.adapter_name).send_comment(
                text=response,
                root=msg.cmt_id,
                sub=msg.sub_cmt_id
            )
        else:
            logger.warning("Blank LLM response")

    async def send_xml_messages(self, event: KiraMessageBatchEvent, xml_data: str, tag_set: TagSet) -> Optional[List[KiraIMSentResult]]:
        """
        send message via session id & xml data
        :param event: KiraMessageBatchEvent
        :param xml_data: xml string
        :param tag_set: TagSet object
        :return: list[KiraIMSentResult]
        """
        parts = event.sid.split(":")
        if len(parts) != 3:
            raise ValueError("invalid target, must follow the form of <adapter>:<dm|gm>:<id>")

        message_results = []
        try:
            message_chains = await self._parse_xml_msg(xml_data, tag_set)

            # EventType.AFTER_XML_PARSE
            llm_handlers = event_handler_reg.get_handlers(event_type=EventType.AFTER_XML_PARSE)
            for handler in llm_handlers:
                await handler.exec_handler(event, message_chains)
                if event.is_stopped:
                    logger.info("Event stopped while AFTER_XML_PARSE stage")
                    return None
        except Exception as e:
            logger.error(f"Error parsing message: {str(e)}")
            return []

        for message_chain in message_chains:
            if not message_chain.is_empty():
                result = await self.send_message_chain(event.sid, message_chain)
                if not result.ok and result.err:
                    logger.error(result.err)
                message_results.append(result)

                # add random message delay
                await asyncio.sleep(random.uniform(self.min_message_delay, self.max_message_delay))
            else:
                message_results.append(KiraIMSentResult(ok=False, err="Blank message list detected"))
        return message_results

    async def send_message_chain(self, session: str, chain: MessageChain) -> KiraIMSentResult:
        """
        Send a MessageChain to target.

        :param session: adapter_name:dm|gm:session_id
        :param chain: MessageChain instance
        :return: message_id (empty string if failed)
        """
        parts = session.split(":")
        if len(parts) != 3:
            raise ValueError("invalid target, must follow <adapter>:<dm|gm>:<id>")

        adapter_name, chat_type, pid = parts
        adapter = self.adapter_mgr.get_adapter(adapter_name)

        if chat_type == "dm":
            result = await adapter.send_direct_message(pid, chain)
        elif chat_type == "gm":
            result = await adapter.send_group_message(pid, chain)
        else:
            raise ValueError("chat_type must be 'dm' or 'gm'")

        if not result:
            return KiraIMSentResult(ok=False)

        return result

    @staticmethod
    async def _parse_xml_msg(xml_data, tag_set: TagSet) -> list[MessageChain]:
        """Parse xml to list[MessageChain]"""
        root = ET.fromstring(f"<root>{xml_data}</root>")
        message_chains = []

        for msg in root.findall("msg"):
            message_elements = []
            for child in msg:
                tag = child.tag
                value = child.text.strip() if child.text else ""
                attrs = child.attrib

                if tag in tag_set:
                    tag_inst = tag_set.get(name=tag)
                    tag_res = await tag_inst.handle(value, **attrs)

                    if isinstance(tag_res, BaseMessageElement):
                        message_elements.append(tag_res)
                    elif isinstance(tag_res, list):
                        message_elements.extend(tag_res)

            if message_elements:
                message_chains.append(MessageChain(message_elements))

        return message_chains

    @staticmethod
    def _add_message_ids(xml_data: str, message_results: List[KiraIMSentResult]) -> str:
        """为XML响应添加消息ID"""
        try:
            root = ET.fromstring(f"<root>{xml_data}</root>")

            for i, msg in enumerate(root.findall("msg")):
                if i < len(message_results):
                    message_id = message_results[i].message_id
                    if not message_id:
                        message_id = ""
                    msg.set("message_id", message_id)

            return ET.tostring(root, encoding='unicode', method='xml')[6:-7]

        except Exception as e:
            logger.error(f"Error adding message IDs: {str(e)}")
            return xml_data
