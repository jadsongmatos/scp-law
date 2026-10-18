"""
Cliente 9Router para geracao e edicao de imagens.
- Geracao: POST /v1/images/generations (prompt direto, sem reference image)
- Edicao:  POST /v1/chat/completions (messages com image_url + text, modalities image)
"""
import base64
import os
import time
from pathlib import Path

import requests

NINEROUTER_BASE_URL = os.getenv(
    "NINEROUTER_API_URL", "http://localhost:20128"
)
NINEROUTER_API_KEY = os.getenv("NINEROUTER_API_KEY", "")

DEFAULT_MODEL = os.getenv("NINEROUTER_IMAGE_MODEL", "ag/gemini-3.1-flash-image")
DEFAULT_RETRIES = 3
DEFAULT_BACKOFF = 10

HEADERS = {
    "Authorization": f"Bearer {NINEROUTER_API_KEY}",
    "Content-Type": "application/json",
}


def generate_image(
    prompt: str,
    model: str = DEFAULT_MODEL,
    size: str = "auto",
    quality: str = "high",
    n: int = 1,
    output_format: str = "png",
    retries: int = DEFAULT_RETRIES,
    backoff: int = DEFAULT_BACKOFF,
) -> str | None:
    """Gera uma imagem via 9Router /v1/images/generations.

    Returns base64-encoded image data (sem prefixo data:) ou None.
    """
    url = f"{NINEROUTER_BASE_URL}/v1/images/generations"
    payload = {
        "model": model,
        "prompt": prompt,
        "n": n,
        "size": size,
        "quality": quality,
        "background": "opaque",
        "image_detail": "original",
        "output_format": output_format,
    }

    print(f"  [generate] POST {url} ({model})...", flush=True)

    for attempt in range(retries):
        try:
            resp = requests.post(url, headers=HEADERS, json=payload, timeout=180)
            resp.raise_for_status()
            result = resp.json()

            if "data" in result and len(result["data"]) > 0:
                item = result["data"][0]
                if "b64_json" in item:
                    return item["b64_json"]
                if "url" in item:
                    img_resp = requests.get(item["url"], timeout=60)
                    img_resp.raise_for_status()
                    return base64.b64encode(img_resp.content).decode()

            print(f"  No image in response.", flush=True)
            if "error" in result:
                print(f"  API Error: {result['error']}", flush=True)
            else:
                print(f"  Response keys: {list(result.keys())}", flush=True)

        except requests.exceptions.HTTPError as e:
            print(f"  HTTP Error (attempt {attempt+1}): {e}")
            if hasattr(e, "response") and e.response is not None:
                print(f"  Response body: {e.response.text[:500]}")
        except Exception as e:
            print(f"  Error (attempt {attempt+1}): {e}")

        if attempt < retries - 1:
            wait = backoff * (attempt + 1)
            print(f"  Retrying in {wait}s...", flush=True)
            time.sleep(wait)

    return None


def edit_image(
    prompt: str,
    reference_image_b64: str,
    model: str = DEFAULT_MODEL,
    retries: int = DEFAULT_RETRIES,
    backoff: int = DEFAULT_BACKOFF,
) -> str | None:
    """Edita uma imagem via 9Router /v1/chat/completions com reference image.

    Returns base64-encoded image data (sem prefixo data:) ou None.
    """
    url = f"{NINEROUTER_BASE_URL}/v1/chat/completions"
    payload = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{reference_image_b64}"}},
            ],
        }],
        "modalities": ["image", "text"],
    }

    print(f"  [edit] POST {url} ({model})...", flush=True)

    for attempt in range(retries):
        try:
            resp = requests.post(url, headers=HEADERS, json=payload, timeout=180)
            resp.raise_for_status()
            result = resp.json()

            if "choices" in result and len(result["choices"]) > 0:
                msg = result["choices"][0].get("message", {})
                if "images" in msg and len(msg["images"]) > 0:
                    img_data = msg["images"][0].get("image_url", {}).get("url", "")
                    if "base64," in img_data:
                        return img_data.split("base64,", 1)[1]
                    return img_data

            print(f"  No image in response.", flush=True)
            if "error" in result:
                print(f"  API Error: {result['error']}", flush=True)
            else:
                print(f"  Response keys: {list(result.keys())}", flush=True)

        except requests.exceptions.HTTPError as e:
            print(f"  HTTP Error (attempt {attempt+1}): {e}")
            if hasattr(e, "response") and e.response is not None:
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
