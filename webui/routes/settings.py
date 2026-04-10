from fastapi import Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
import os
import uuid
import json

from webui.models import SettingsRequest, SettingsResponse, BackgroundMusicSettings, BackgroundMusicRequest
from webui.routes.auth import require_auth
from webui.routes.base import RouteDefinition, Routes
from core.logging_manager import get_logger

logger = get_logger("settings", "blue")

MUSIC_DIR = os.path.join("data", "music")
MUSIC_CONFIG_FILE = os.path.join("data", "config", "background_music.json")


class SettingsRoutes(Routes):
    def __init__(self, app, lifecycle):
        super().__init__(app, lifecycle)
        self._settings = SettingsResponse()
        self._background_music = self._load_background_music_settings()
        os.makedirs(MUSIC_DIR, exist_ok=True)

    def _load_background_music_settings(self) -> BackgroundMusicSettings:
        if os.path.exists(MUSIC_CONFIG_FILE):
            try:
                with open(MUSIC_CONFIG_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return BackgroundMusicSettings(**data)
            except Exception as e:
                logger.error(f"Failed to load background music settings: {e}")
        return BackgroundMusicSettings()

    def _save_background_music_settings(self):
        os.makedirs(os.path.dirname(MUSIC_CONFIG_FILE), exist_ok=True)
        try:
            with open(MUSIC_CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(self._background_music.model_dump(), f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save background music settings: {e}")

    def get_routes(self):
        return [
            RouteDefinition(
                path="/api/settings",
                methods=["GET"],
                endpoint=self.get_settings,
                response_model=SettingsResponse,
                tags=["settings"],
                dependencies=[Depends(require_auth)],
            ),
            RouteDefinition(
                path="/api/settings",
                methods=["PUT"],
                endpoint=self.update_settings,
                response_model=SettingsResponse,
                tags=["settings"],
                dependencies=[Depends(require_auth)],
            ),
            RouteDefinition(
                path="/api/settings/background-music",
                methods=["GET"],
                endpoint=self.get_background_music,
                response_model=BackgroundMusicSettings,
                tags=["settings"],
                dependencies=[Depends(require_auth)],
            ),
            RouteDefinition(
                path="/api/settings/background-music",
                methods=["PUT"],
                endpoint=self.update_background_music,
                response_model=BackgroundMusicSettings,
                tags=["settings"],
                dependencies=[Depends(require_auth)],
            ),
            RouteDefinition(
                path="/api/settings/background-music/upload",
                methods=["POST"],
                endpoint=self.upload_music_file,
                tags=["settings"],
                dependencies=[Depends(require_auth)],
            ),
            RouteDefinition(
                path="/api/settings/background-music/files",
                methods=["GET"],
                endpoint=self.list_music_files,
                tags=["settings"],
                dependencies=[Depends(require_auth)],
            ),
            RouteDefinition(
                path="/api/settings/background-music/files/{filename}",
                methods=["GET"],
                endpoint=self.get_music_file,
                tags=["settings"],
            ),
            RouteDefinition(
                path="/api/settings/background-music/files/{filename}",
                methods=["DELETE"],
                endpoint=self.delete_music_file,
                tags=["settings"],
                dependencies=[Depends(require_auth)],
            ),
        ]

    async def get_settings(self):
        return self._settings

    async def update_settings(self, payload: SettingsRequest):
        self._settings = SettingsResponse(**payload.model_dump(), updated_by="admin")
        return self._settings

    async def get_background_music(self):
        return self._background_music

    async def update_background_music(self, payload: BackgroundMusicRequest):
        current = self._background_music.model_dump()
        update_data = payload.model_dump(exclude_unset=True)
        current.update(update_data)
        if "volume" in current and current["volume"] is not None:
            current["volume"] = max(0.0, min(1.0, current["volume"]))
        self._background_music = BackgroundMusicSettings(**current)
        self._save_background_music_settings()
        return self._background_music

    async def upload_music_file(self, file: UploadFile = File(...)):
        allowed_extensions = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"}
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"
            )
        
        file_id = uuid.uuid4().hex[:12]
        filename = f"{file_id}{file_ext}"
        filepath = os.path.join(MUSIC_DIR, filename)
        
        try:
            content = await file.read()
            with open(filepath, "wb") as f:
                f.write(content)
            
            return {
                "success": True,
                "filename": filename,
                "original_name": file.filename,
                "size": len(content),
                "url": f"/api/settings/background-music/files/{filename}"
            }
        except Exception as e:
            logger.error(f"Failed to upload music file: {e}")
            raise HTTPException(status_code=500, detail="Failed to upload file")

    async def list_music_files(self):
        files = []
        if os.path.exists(MUSIC_DIR):
            for filename in os.listdir(MUSIC_DIR):
                filepath = os.path.join(MUSIC_DIR, filename)
                if os.path.isfile(filepath):
                    stat = os.stat(filepath)
                    files.append({
                        "filename": filename,
                        "size": stat.st_size,
                        "modified": stat.st_mtime,
                        "url": f"/api/settings/background-music/files/{filename}"
                    })
        return {"files": files}

    async def get_music_file(self, filename: str):
        filepath = os.path.join(MUSIC_DIR, filename)
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(
            filepath,
            media_type="audio/mpeg",
            filename=filename
        )

    async def delete_music_file(self, filename: str):
        filepath = os.path.join(MUSIC_DIR, filename)
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="File not found")
        
        try:
            os.remove(filepath)
            if self._background_music.url and self._background_music.url.endswith(filename):
                self._background_music.url = ""
                self._save_background_music_settings()
            return {"success": True, "message": "File deleted"}
        except Exception as e:
            logger.error(f"Failed to delete music file: {e}")
            raise HTTPException(status_code=500, detail="Failed to delete file")
