"""
Agent Executor Module.

This module provides the AgentExecutor class for managing multi-step
LLM interactions with tool calling capabilities, including execution
context management and step result tracking.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Optional, TYPE_CHECKING, Union, Literal

from core.logging_manager import get_logger
from core.llm_client import LLMClient
from core.provider import LLMRequest, LLMResponse, LLMModelClient
from core.agent.tool import ToolSet
from core.plugin.plugin_handlers import event_handler_reg, EventType

if TYPE_CHECKING:
    from core.chat.message_utils import KiraMessageBatchEvent


logger = get_logger("agent_executor", "cyan")
llm_logger = get_logger("llm", "purple")


@dataclass
class AgentExecutionContext:
    """
    Context for agent execution containing all necessary components.

    Attributes:
        event: The message batch event being processed.
        request: The LLM request to be sent.
        llm_model: The LLM model client to use.
        new_memory: NewMemory instance for tracking conversation history.
    """
    event: KiraMessageBatchEvent
    request: LLMRequest
    llm_model: LLMModelClient
    new_memory: NewMemory


@dataclass
class AgentStepResult:
    """
    Result of a single agent execution step.

    Attributes:
        state: Execution state - 'success', 'stopped', or 'error'.
        step_index: Zero-based index of this step.
        llm_response: The LLM response from this step, if any.
        new_memory: Updated memory from this step.
        is_final: Whether this is the final step.
        has_tool_calls: Whether the response contains tool calls.
        err: Error message if state is 'error'.
    """
    state: Literal["success", "stopped", "error"]
    step_index: int
    llm_response: Optional[LLMResponse]
    new_memory: NewMemory
    is_final: bool
    has_tool_calls: bool
    err: Optional[str] = None


@dataclass
class NewMemory:
    """
    Container for building new conversation memory entries.

    Provides methods for adding user, assistant, and tool messages
    to the memory list.

    Attributes:
        memory_list: List of message dictionaries.
    """
    memory_list: list = field(default_factory=list)

    def user(self, content: Union[str, dict]):
        """
        Add a user message to memory.

        Args:
            content: Message content, either a string or dict.
        """
        self.memory_list.append(
            {
                "role": "user",
                "content": content
            }
        )

    # Add reasoning_content param, defaults to blank string，to satisfy the requirements of Kimi API
    def assistant(self, content: str, tool_calls: Optional[list[dict]] = None, reasoning_content: str = ""):
        """
        Add an assistant message to memory.

        Args:
            content: Text content of the assistant's response.
            tool_calls: Optional list of tool call dictionaries.
            reasoning_content: Optional reasoning content (for models like Kimi).
        """
        if not tool_calls:
            self.memory_list.append(
                {
                    "role": "assistant",
                    "content": content,
                    "reasoning_content": reasoning_content
                }
            )
        else:
            self.memory_list.append(
                {
                    "role": "assistant",
                    "content": content,
                    "tool_calls": tool_calls,
                    "reasoning_content": reasoning_content
                }
            )

    def tool(self, tool_results: list[dict]):
        """
        Add tool result messages to memory.

        Args:
            tool_results: List of tool result dictionaries.
        """
        self.memory_list.extend(tool_results)
         # self.memory_list.append({
        #     "role": "tool",
        #     "tool_call_id": tool_call_id,
        #     "name": name,
        #     "content": str(result)
        # })


class AgentExecutor:
    """
    Agent Executor for managing multi-step LLM conversations with tool calling.

    This class handles the iterative process of LLM calls and tool execution,
    yielding step results for each iteration.

    Attributes:
        llm_api: LLMClient instance for making LLM calls.
        tool_set: Optional ToolSet containing available tools.
    """

    def __init__(self, llm_api: LLMClient, tool_set: Optional[ToolSet] = None):
        self.llm_api = llm_api
        self.tool_set = tool_set

    async def run(
        self,
        ctx: AgentExecutionContext,
        max_steps: int,
    ) -> AsyncIterator[AgentStepResult]:
        """
        Execute the agent loop with a maximum number of steps.

        Args:
            ctx: Agent execution context containing event, request, and model.
            max_steps: Maximum number of LLM calls to make.

        Yields:
            AgentStepResult for each step of execution.
        """
        event = ctx.event
        request = ctx.request
        llm_model = ctx.llm_model

        provider_name = llm_model.model.provider_name
        model_id = llm_model.model.model_id
        llm_logger.info(f"Running agent using {model_id} ({provider_name})")
        logger.debug(f"[AgentExecutor] === Agent Execution START ===")
        logger.debug(f"[AgentExecutor] Model: {model_id}, Provider: {provider_name}")
        logger.debug(f"[AgentExecutor] Max steps: {max_steps}")

        for step_index in range(max_steps):
            logger.debug(f"[AgentExecutor] --- Step {step_index + 1}/{max_steps} ---")
            logger.debug(f"[AgentExecutor] Calling LLM chat...")
            llm_resp = await llm_model.chat(request)

            if not llm_resp:
                logger.debug(f"[AgentExecutor] LLM returned empty response")
                # Add reasoning_content
                request.messages.append({"role": "assistant", "content": "", "reasoning_content": ""})
                ctx.new_memory.assistant("", reasoning_content="")
                step_result = AgentStepResult(
                    state="error",
                    err="Failed to call LLM",
                    step_index=step_index,
                    llm_response=None,
                    new_memory=ctx.new_memory,
                    is_final=True,
                    has_tool_calls=False,
                )
                logger.debug(f"[AgentExecutor] AgentStepResult: step={step_result.step_index}, state={step_result.state}, has_tool_calls={step_result.has_tool_calls}, is_final={step_result.is_final}, err={step_result.err}")
                yield step_result
                return

            llm_resp.agent_step_index = step_index
            llm_logger.info(
                f"Time consumed: {llm_resp.time_consumed}s, Input tokens: {llm_resp.input_tokens}, output tokens: {llm_resp.output_tokens}"
            )

            if llm_resp.text_response:
                logger.debug(f"[AgentExecutor] LLM text response: {llm_resp.text_response[:200]}{'...' if len(llm_resp.text_response) > 200 else ''}")

            if llm_resp.reasoning_content:
                logger.debug(f"[AgentExecutor] Reasoning content length: {len(llm_resp.reasoning_content)}")

            llm_resp_handlers = event_handler_reg.get_handlers(event_type=EventType.ON_LLM_RESPONSE)
            for handler in llm_resp_handlers:
                logger.debug(f"[AgentExecutor] Executing ON_LLM_RESPONSE handler: {handler.desc or handler.handler.__name__}")
                await handler.exec_handler(event, llm_resp)
                if event.is_stopped:
                    logger.info("Event stopped")
                    step_result = AgentStepResult(
                        state="stopped",
                        step_index=step_index,
                        llm_response=llm_resp,
                        new_memory=ctx.new_memory,
                        is_final=True,
                        has_tool_calls=bool(llm_resp.tool_calls),
                    )
                    logger.debug(f"[AgentExecutor] AgentStepResult: step={step_result.step_index}, state={step_result.state}, has_tool_calls={step_result.has_tool_calls}, is_final={step_result.is_final}")
                    yield step_result
                    return

            has_tool_calls = bool(llm_resp.tool_calls)

            if not has_tool_calls:
                logger.debug(f"[AgentExecutor] No tool calls, finalizing response...")
                assistant_content = llm_resp.text_response or ""
                reasoning = llm_resp.reasoning_content or ""
                # Add reasoning_content
                request.messages.append(
                    {
                        "role": "assistant",
                        "content": assistant_content,
                        "reasoning_content": reasoning
                    }
                )
                ctx.new_memory.assistant(assistant_content, reasoning_content=reasoning)
                logger.debug(f"[AgentExecutor] === Agent Execution END (no tool calls) ===")
                step_result = AgentStepResult(
                    state="success",
                    step_index=step_index,
                    llm_response=llm_resp,
                    new_memory=ctx.new_memory,
                    is_final=True,
                    has_tool_calls=False,
                )
                logger.debug(f"[AgentExecutor] AgentStepResult: step={step_result.step_index}, state={step_result.state}, has_tool_calls={step_result.has_tool_calls}, is_final={step_result.is_final}")
                yield step_result
                return

            logger.debug(f"[AgentExecutor] Tool calls detected: {len(llm_resp.tool_calls)}")
            for i, tc in enumerate(llm_resp.tool_calls):
                tool_name = tc.get("function", {}).get("name", "unknown")
                logger.debug(f"[AgentExecutor]   -> Tool call {i+1}: {tool_name}")

            assistant_content = llm_resp.text_response or ""
            reasoning = llm_resp.reasoning_content or ""

            await self.llm_api.execute_tool(event, llm_resp, tool_set=self.tool_set)
            # Add reasoning_content
            request.messages.append(
                {
                    "role": "assistant",
                    "content": assistant_content,
                    "tool_calls": llm_resp.tool_calls,
                    "reasoning_content": reasoning
                }
            )
            ctx.new_memory.assistant(assistant_content, llm_resp.tool_calls, reasoning_content=reasoning)
            request.messages.extend(llm_resp.tool_results)
            ctx.new_memory.tool(llm_resp.tool_results)

            is_final = step_index == max_steps - 1
            if is_final:
                logger.debug(f"[AgentExecutor] === Agent Execution END (max steps reached) ===")
            step_result = AgentStepResult(
                state="success",
                step_index=step_index,
                llm_response=llm_resp,
                new_memory=ctx.new_memory,
                is_final=is_final,
                has_tool_calls=True,
            )
            logger.debug(f"[AgentExecutor] AgentStepResult: step={step_result.step_index}, state={step_result.state}, has_tool_calls={step_result.has_tool_calls}, is_final={step_result.is_final}")
            yield step_result
            if is_final:
                return
