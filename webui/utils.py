"""
Shared utility functions for the WebUI.
"""
import json
import os
import secrets
import string
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Optional

from fastapi import HTTPException, status
import jwt

from core.logging_manager import get_logger

logger = get_logger("webui", "blue")

_JWT_SECRET_KEY: Optional[str] = None


def _get_jwt_secret_key() -> str:
    """Get or generate JWT secret key from environment or config."""
    global _JWT_SECRET_KEY
    if _JWT_SECRET_KEY:
        return _JWT_SECRET_KEY
    
    env_key = os.environ.get("KIRA_JWT_SECRET")
    if env_key and len(env_key) >= 32:
        _JWT_SECRET_KEY = env_key
        return _JWT_SECRET_KEY
    
    config = _load_webui_config()
    config_key = config.get("jwt_secret_key")
    if config_key and len(config_key) >= 32:
        _JWT_SECRET_KEY = config_key
        return _JWT_SECRET_KEY
    
    _JWT_SECRET_KEY = secrets.token_urlsafe(32)
    config["jwt_secret_key"] = _JWT_SECRET_KEY
    _save_webui_config(config)
    logger.info("Generated new JWT secret key")
    return _JWT_SECRET_KEY


def _generate_strong_password(length: int = 16) -> str:
    """Generate a strong password with upper/lower alphabets, digits, and special characters."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()_+-=[]{}|;:,.<>?"
    token = ''.join(secrets.choice(alphabet) for _ in range(length))
    logger.info("Generated new access_token")
    return token


def _load_webui_config() -> Dict:
    """Load webui.json"""
    config_path = Path(__file__).parent.parent / "data" / "webui.json"
    if config_path.exists():
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"host": "0.0.0.0", "port": 5267}


def _save_webui_config(config: Dict):
    """Save webui.json file"""
    config_path = Path(__file__).parent.parent / "data" / "webui.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def _get_or_generate_access_token() -> str:
    """Get or generate access_token"""
    config = _load_webui_config()
    if "access_token" not in config or not config["access_token"]:
        config["access_token"] = _generate_strong_password()
        _save_webui_config(config)
    return config["access_token"]


def _create_jwt_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=5)
    to_encode.update({"exp": expire})
    secret_key = _get_jwt_secret_key()
    encoded_jwt = jwt.encode(to_encode, secret_key, algorithm="HS256")
    return encoded_jwt


def _verify_jwt_token(token: str) -> Dict:
    """Verify JWT token"""
    try:
        secret_key = _get_jwt_secret_key()
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


def _generate_id() -> str:
    """Generate a short unique identifier."""
    return uuid.uuid4().hex[:12]


def schema_to_dict(fields: list) -> dict:
    """Convert a list of BaseConfigField objects to a plain dict keyed by field.key.

    Fields whose key is missing or whose to_dict() raises are silently skipped.
    """
    result: dict = {}
    for f in fields:
        key = getattr(f, "key", None)
        if not key:
            continue
        try:
            result[str(key)] = f.to_dict()
        except Exception:
            continue
    return result
