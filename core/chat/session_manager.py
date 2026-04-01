"""
Session Manager Module.

This module provides the SessionManager class for managing chat sessions,
including conversation history, session metadata, and memory persistence.
"""

import asyncio
import json
import os
import time
import uuid
from typing import Dict, List, Optional
from threading import Lock

from core.logging_manager import get_logger
from core.config import KiraConfig
from core.utils.path_utils import get_data_path

from .session import Session

logger = get_logger("session", "green")

CHAT_MEMORY_PATH: str = f"{get_data_path()}/memory/chat_memory.json"
CORE_MEMORY_PATH: str = f"{get_data_path()}/memory/core.txt"


class SessionManager:
    """
    Manager for chat sessions and conversation memory.

    Handles loading, saving, and updating session data including
    conversation history, session titles, and metadata.

    Attributes:
        kira_config: KiraConfig instance containing application settings.
        max_memory_length: Maximum number of conversation turns to keep.
        chat_memory_path: Path to the chat memory JSON file.
        memory_lock: Thread lock for memory operations.
        chat_memory: Dictionary of session data keyed by session ID.
    """

    def __init__(self, kira_config: KiraConfig):
        self.kira_config = kira_config
        self.max_memory_length = int(kira_config["bot_config"].get("bot").get("max_memory_length"))
        self.chat_memory_path = CHAT_MEMORY_PATH

        self.memory_lock = Lock()
        self._async_lock = asyncio.Lock()

        # === Session history ===
        self.chat_memory = self._load_memory(self.chat_memory_path)
        self._ensure_memory_format()

        # === 缓存 ===
        self._session_count_cache: Dict[str, int] = {}
        self._cache_valid = False

    @staticmethod
    def _load_memory(path: str) -> Dict[str, dict]:
        """
        Load memory from a JSON file.

        Args:
            path: Path to the JSON file.

        Returns:
            Dictionary of session data, or empty dict if file doesn't exist.
        """
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    memory_content = f.read()
                    if memory_content.strip():
                        return json.loads(memory_content)
                    else:
                        return {}
            except Exception as e:
                import traceback
                err = traceback.format_exc()
                logger.error(f"Error loading memory from {path}: {e}")
                logger.error(err)
                return {}
        else:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            return {}

    def _ensure_memory_format(self):
        for session in self.chat_memory:
            session_content = self.chat_memory[session]
            if isinstance(session_content, dict):
                continue

            if isinstance(session_content, list):
                self.chat_memory[session] = {
                    "title": "",
                    "description": "",
                    "timestamp": None,
                    "memory": session_content
                }
        self._save_memory(self.chat_memory, self.chat_memory_path)

    def _ensure_session_data(self, session: str):
        with self.memory_lock:
            if session not in self.chat_memory:
                self.chat_memory[session] = {
                    "title": "",
                    "description": "",
                    "timestamp": None,
                    "memory": []
                }
            else:
                session_data = self.chat_memory[session]
                if "title" not in session_data:
                    session_data["title"] = ""
                if "description" not in session_data:
                    session_data["description"] = ""
                if "timestamp" not in session_data:
                    session_data["timestamp"] = None
            self._save_memory()

    def _save_memory(self, memory: Dict[str, dict] = None, path: str = None):
        """
        Save memory to a JSON file.

        Args:
            memory: Memory dictionary to save, defaults to chat_memory.
            path: File path to save to, defaults to chat_memory_path.
        """
        if not memory:
            memory = self.chat_memory
        if not path:
            path = self.chat_memory_path
        try:
            with open(path, "w", encoding="utf-8") as f:
                f.write(json.dumps(memory, indent=4, ensure_ascii=False))
            self._cache_valid = False
        except Exception as e:
            logger.error(f"Error saving memory to {path}: {e}")

    def get_session_info(self, session: str):
        parts = session.split(":", maxsplit=2)
        if len(parts) != 3:
            raise ValueError("Invalid session ID")
        self._ensure_session_data(session)
        session_data = self.chat_memory[session]
        return Session(
            adapter_name=parts[0],
            session_type=parts[1],
            session_id=parts[2],
            session_title=session_data["title"],
            session_description=session_data["description"],
            timestamp=session_data["timestamp"]
        )

    def update_session_info(self, session: str, title: str = None, description: str = None):
        self._ensure_session_data(session)
        with self.memory_lock:
            session_data = self.chat_memory[session]
            if title:
                session_data["title"] = title
            if description:
                session_data["description"] = description
            self._save_memory()

    def get_memory_count(self, session: str) -> int:
        if session not in self.chat_memory:
            return 0
        if not self._cache_valid:
            self._session_count_cache.clear()
            for s, data in self.chat_memory.items():
                self._session_count_cache[s] = len(data.get("memory", []))
            self._cache_valid = True
        return self._session_count_cache.get(session, 0)

    def fetch_memory(self, session: str):
        self._ensure_session_data(session)
        mem_list = self.chat_memory[session].get("memory", [])
        messages = []
        for chunk in mem_list:
            for message in chunk:
                messages.append(message)
        return messages

    def read_memory(self, session: str):
        """
        Read raw memory chunks for a session.

        Args:
            session: Session ID.

        Returns:
            List of memory chunk lists.
        """
        self._ensure_session_data(session)
        return self.chat_memory[session].get("memory", [])

    def write_memory(self, session: str, memory: list[list[dict]]):
        """
        Write complete memory for a session.

        Args:
            session: Session ID.
            memory: List of memory chunks to write.
        """
        with self.memory_lock:
            self.chat_memory[session]["memory"] = memory
            self._save_memory(self.chat_memory, self.chat_memory_path)
        logger.info(f"Memory written for {session}")

    def update_memory(self, session: str, new_chunk):
        """
        Append a new memory chunk to a session.

        Args:
            session: Session ID.
            new_chunk: New memory chunk to append.
        """
        self._ensure_session_data(session)
        with self.memory_lock:
            session_data = self.chat_memory[session]

            session_data["timestamp"] = int(time.time())
            session_data["memory"].append(new_chunk)
            if len(session_data["memory"]) > self.max_memory_length:
                session_data["memory"] = session_data["memory"][-self.max_memory_length:]
            self._cache_valid = False
        self._save_memory(self.chat_memory, self.chat_memory_path)
        logger.info(f"Memory updated for {session}")

    def delete_session(self, session: str):
        """
        Delete a session and its memory.

        Args:
            session: Session ID to delete.
        """
        with self.memory_lock:
            self.chat_memory.pop(session)
            self._save_memory(self.chat_memory, self.chat_memory_path)
        logger.info(f"Memory deleted for {session}")
