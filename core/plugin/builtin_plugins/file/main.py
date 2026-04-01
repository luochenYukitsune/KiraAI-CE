from pathlib import Path
import os

from core.plugin import BasePlugin, logger, register_tool as tool
from core.chat import KiraMessageBatchEvent

from core.utils.path_utils import get_data_path

restricted_paths = ['~/.ssh/', '~/.gnupg/', '~/.aws/', '~/.config/gh/', '.pem',
                    '.p12', 'key', 'secret', 'password', 'token', 'credential']

blocked_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg',
                      '.mp3', '.mp4', '.wav', '.ogg', '.flac', '.aac', '.silk', '.slk',
                      '.slac', '.amr', '.avi', '.mkv', '.mov', '.flv', '.wmv',
                      '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.exe', '.bin',
                      '.dll', '.so', '.dylib', '.pdf', '.doc', '.docx', '.xls', '.xlsx',
                      '.ppt', '.pptx', '.iso', '.img', '.dmg'}

ALLOWED_BASE_DIRS = {'files', 'temp'}


def _validate_path(path: str) -> tuple[bool, str, Path | None]:
    """
    Validate file path for security.
    Returns: (is_valid, error_message, absolute_path)
    """
    if not path:
        return False, "Path cannot be empty", None
    
    normalized = os.path.normpath(path).replace('\\', '/')
    
    for rp in restricted_paths:
        if rp.lower() in normalized.lower():
            return False, "Permission denied: Path contains restricted keywords", None
    
    if ".." in normalized:
        return False, "Permission denied: Path traversal detected", None
    
    parts = normalized.split('/')
    if len(parts) < 2 or parts[0] != 'data' or parts[1] not in ALLOWED_BASE_DIRS:
        return False, f"Permission denied: Path must start with data/files or data/temp", None
    
    rel_path = '/'.join(parts[1:])
    abs_path = get_data_path() / rel_path
    
    try:
        abs_path_resolved = abs_path.resolve()
        data_path_resolved = get_data_path().resolve()
        
        try:
            abs_path_resolved.relative_to(data_path_resolved)
        except ValueError:
            return False, "Permission denied: Path escapes data directory", None
            
    except Exception as e:
        return False, f"Invalid path: {e}", None
    
    return True, "", abs_path


class FilePlugin(BasePlugin):
    """
    FilePlugin
    """

    def __init__(self, ctx, cfg: dict):
        super().__init__(ctx, cfg)
        self.allowed_sessions = list()

    async def initialize(self):
        self.allowed_sessions = self.plugin_cfg.get("allowed_sessions", [])

    async def terminate(self):
        pass

    @tool(
        "read_file",
        "Read a plain text file (txt, html, py, etc..) in `data/files` or `data/temp`",
        {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path, must start with `data/`"},
                "offset": {"type": "integer", "description": "Which line to start reading, defaults to 1"},
                "limit": {"type": "integer", "description": "Maximum lines to read, defaults to 50"},
            },
            "required": ["path"]
        }
    )
    async def read_file(self, event: KiraMessageBatchEvent, path: str, offset: int = 1, limit: int = 50) -> str:
        if event.sid not in self.allowed_sessions:
            return "Permission denied: current session not allowed to access local files"

        ext = Path(path).suffix.lower()
        if ext in blocked_extensions:
            return "Multimedia and binary files are not allowed"

        is_valid, error_msg, abs_path = _validate_path(path)
        if not is_valid:
            return error_msg

        try:
            with open(abs_path, 'r', encoding="utf-8") as f:
                file_lines = f.readlines()
            if offset > len(file_lines) or offset < 1:
                return "Offset out of range"

            file_lines = file_lines[offset-1:offset-1+limit]

            return "".join(file_lines)
        except Exception as e:
            return f"Failed to read file: {e}"

    @tool(
        "write_file",
        "Write content to a plain text file in `data/files` or `data/temp`. Creates the file if it doesn't exist, overwrites if it does.",
        {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path, must start with `data/`"},
                "content": {"type": "string", "description": "Content to write to the file"},
            },
            "required": ["path", "content"]
        }
    )
    async def write_file(self, event: KiraMessageBatchEvent, path: str, content: str) -> str:
        if event.sid not in self.allowed_sessions:
            return "Permission denied: current session not allowed to access local files"

        ext = Path(path).suffix.lower()
        if ext in blocked_extensions:
            return "Multimedia and binary files are not allowed"

        is_valid, error_msg, abs_path = _validate_path(path)
        if not is_valid:
            return error_msg

        try:
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            with open(abs_path, 'w', encoding="utf-8") as f:
                f.write(content)
            return "File written successfully"
        except Exception as e:
            return f"Failed to write file: {e}"

    @tool(
        "edit_file",
        "Edit a plain text file by replacing exact text. The oldText must match exactly (including whitespace). Better use this tool when you only want to modify or add a part of content to a file instead of using `write_file` to re-write the entire file",
        {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path, must start with `data/`"},
                "old_text": {"type": "string",
                             "description": "Exact text to find and replace (must match exactly, including whitespace)"},
                "new_text": {"type": "string", "description": "New text to replace the old text with"},
            },
            "required": ["path", "old_text", "new_text"]
        }
    )
    async def edit_file(self, event: KiraMessageBatchEvent, path: str, old_text: str, new_text: str) -> str:
        if event.sid not in self.allowed_sessions:
            return "Permission denied: current session not allowed to access local files"

        ext = Path(path).suffix.lower()
        if ext in blocked_extensions:
            return "Permission denied: Multimedia and binary files are not allowed"

        is_valid, error_msg, abs_path = _validate_path(path)
        if not is_valid:
            return error_msg

        try:
            with open(abs_path, 'r', encoding="utf-8") as f:
                content = f.read()

            if old_text not in content:
                return f"Error: old_text not found in file. Please check the content and try again."

            import re

            replacements = len(re.findall(re.escape(old_text), content))

            new_content = content.replace(old_text, new_text)

            abs_path.parent.mkdir(parents=True, exist_ok=True)
            with open(abs_path, 'w', encoding="utf-8") as f:
                f.write(new_content)

                return f"Successfully edited file: {path}, {replacements} replacement(s) made."
        except Exception as e:
            return f"Failed to edit file: {str(e)}"
