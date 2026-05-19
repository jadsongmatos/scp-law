import base64
import json
import os
import time
from pathlib import Path

import requests

from .config import (
    OPENROUTER_API_URL,
    OPENROUTER_API_KEY,
    IMAGE_MODEL,
    VISION_MODEL,
    DEFAULT_RETRIES,
    DEFAULT_BACKOFF,
)
from .ipv4_fix import force_ipv4

HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
}


def generate_image(
    prompt: str,
    reference_image_b64: str | None = None,
    model: str = IMAGE_MODEL,
    aspect_ratio: str = "16:9",
    image_size: str = "2K",
    retries: int = DEFAULT_RETRIES,
    backoff: int = DEFAULT_BACKOFF,
) -> str | None:
    messages = []

    if reference_image_b64:
        content = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{reference_image_b64}"}},
        ]
        messages.append({"role": "user", "content": content})
    else:
        messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model,
        "messages": messages,
        "modalities": ["image", "text"],
        "image_config": {
            "aspect_ratio": aspect_ratio,
            "image_size": image_size,
        },
    }

    print(f"  Sending request to {model}...", flush=True)

    for attempt in range(retries):
        try:
            resp = requests.post(OPENROUTER_API_URL, headers=HEADERS, json=payload, timeout=180)
            resp.raise_for_status()
            result = resp.json()

            if "choices" in result and len(result["choices"]) > 0:
                msg = result["choices"][0]["message"]
                if "images" in msg and len(msg["images"]) > 0:
                    img_data = msg["images"][0]["image_url"]["url"]
                    if "base64," in img_data:
                        return img_data.split("base64,", 1)[1]
                    return img_data

            print(f"  No image in response.", flush=True)
            if "error" in result:
                print(f"  API Error: {result['error']}", flush=True)
            elif "choices" in result:
                msg = result["choices"][0]["message"]
                if "content" in msg:
                    print(f"  Text content: {msg['content'][:200]}...", flush=True)

        except requests.exceptions.HTTPError as e:
            print(f"  HTTP Error (attempt {attempt+1}): {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"  Response body: {e.response.text[:500]}")
        except Exception as e:
            print(f"  Error (attempt {attempt+1}): {e}")

        if attempt < retries - 1:
            wait = backoff * (attempt + 1)
            print(f"  Retrying in {wait}s...", flush=True)
            time.sleep(wait)

    return None


def save_image(b64_data: str, filepath: Path, backup: bool = False) -> bool:
    try:
        img_bytes = base64.b64decode(b64_data)
        if backup and filepath.exists():
            backup_path = filepath.with_suffix(filepath.suffix + ".bak")
            filepath.rename(backup_path)
            print(f"  Backed up: {backup_path}")
        filepath.parent.mkdir(parents=True, exist_ok=True)
        filepath.write_bytes(img_bytes)
        size_kb = len(img_bytes) / 1024
        print(f"  Saved: {filepath} ({size_kb:.0f} KB)")
        return True
    except Exception as e:
        print(f"  Failed to save {filepath}: {e}")
        return False


def vision_query(
    prompt: str,
    image_b64: str,
    mime: str = "image/png",
    model: str = VISION_MODEL,
    retries: int = DEFAULT_RETRIES,
    backoff: int = DEFAULT_BACKOFF,
    timeout: int = 120,
) -> str | None:
    messages = [{
        "role": "user",
        "content": [
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
            {"type": "text", "text": prompt},
        ],
    }]

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 4096,
    }

    for attempt in range(retries):
        try:
            resp = requests.post(OPENROUTER_API_URL, headers=HEADERS, json=payload, timeout=timeout)
            resp.raise_for_status()
            result = resp.json()
            return result["choices"][0]["message"]["content"]
        except Exception as e:
            print(f"  Error (attempt {attempt+1}): {e}")
            if attempt < retries - 1:
                time.sleep(backoff * (attempt + 1))

    return None
