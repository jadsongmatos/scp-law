import base64
import os
import requests
from pathlib import Path

NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/images/edits"
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")

# Headers do opencode NVIDIA plugin
NVIDIA_HEADERS = {
    "HTTP-Referer": "https://opencode.ai/",
    "X-Title": "opencode",
    "X-BILLING-INVOKE-ORIGIN": "OpenCode",
}


def edit_image(
    prompt: str,
    image_path: Path,
    model: str = "qwen/qwen-image-edit-2511",
) -> str | None:
    if not NVIDIA_API_KEY:
        print("ERRO: Defina NVIDIA_API_KEY")
        return None

    img_bytes = image_path.read_bytes()
    mime = "image/jpeg" if image_path.suffix.lower() in (".jpg", ".jpeg") else "image/png"
    img_b64 = base64.b64encode(img_bytes).decode()

    payload = {
        "model": model,
        "prompt": prompt,
        "image": f"data:{mime};base64,{img_b64}",
        "n": 1,
        "response_format": "b64_json",
    }

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
        **NVIDIA_HEADERS,
    }

    print(f"  POST {NVIDIA_API_URL} ({model}) [{image_path.name}, {len(img_bytes) // 1024} KB]...", flush=True)
    resp = requests.post(
        NVIDIA_API_URL,
        headers=headers,
        json=payload,
        timeout=180,
    )

    if resp.status_code != 200:
        print(f"  HTTP {resp.status_code} ERRO: {resp.text[:500]}")
        return None

    result = resp.json()
    if "data" in result and len(result["data"]) > 0:
        return result["data"][0].get("b64_json")
    print(f"  Sem imagem na resposta: {str(result)[:500]}")
    return None
