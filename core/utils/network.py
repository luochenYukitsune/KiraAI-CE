import httpx
from typing import Optional
import asyncio
import logging

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 60.0
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY = 1.0


async def download_file(
    url: str,
    path: str,
    proxy: Optional[str] = None,
    timeout: float = DEFAULT_TIMEOUT,
    max_retries: int = DEFAULT_MAX_RETRIES,
    retry_delay: float = DEFAULT_RETRY_DELAY
):
    client_kwargs: dict = {"follow_redirects": True, "timeout": timeout}
    if proxy:
        client_kwargs["proxy"] = proxy

    last_error = None
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                async with client.stream("GET", url) as resp:
                    resp.raise_for_status()
                    with open(path, "wb") as f:
                        async for chunk in resp.aiter_bytes():
                            f.write(chunk)
                return resp
        except (httpx.HTTPStatusError, httpx.RequestError, httpx.TimeoutException) as e:
            last_error = e
            if attempt < max_retries - 1:
                logger.warning(f"Download attempt {attempt + 1} failed for {url}: {e}. Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay * (2 ** attempt))
            continue
    raise last_error or Exception(f"Failed to download file from {url}")


async def get_file_content(
    url: str,
    timeout: float = DEFAULT_TIMEOUT,
    max_retries: int = DEFAULT_MAX_RETRIES,
    retry_delay: float = DEFAULT_RETRY_DELAY
):
    last_error = None
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.content
        except (httpx.HTTPStatusError, httpx.RequestError, httpx.TimeoutException) as e:
            last_error = e
            if attempt < max_retries - 1:
                logger.warning(f"Fetch attempt {attempt + 1} failed for {url}: {e}. Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay * (2 ** attempt))
            continue
    raise last_error or Exception(f"Failed to fetch content from {url}")
