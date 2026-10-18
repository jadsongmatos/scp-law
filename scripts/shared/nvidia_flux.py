import base64
import os
import requests
import time
from pathlib import Path

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
MODEL_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"

def generate_or_edit(
    prompt: str,
    image_path: Path | None = None,
    aspect_ratio: str = "match_input_image",
    steps: int = 50,
    cfg_scale: float = 3.5,
    seed: int = 0,
) -> str | None:
    if not NVIDIA_API_KEY:
        print("ERRO: Defina NVIDIA_API_KEY")
        return None

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    if image_path and image_path.exists():
        img_b64 = base64.b64encode(image_path.read_bytes()).decode()
        data_url = f"data:image/png;base64,{img_b64}"
    else:
        data_url = "data:image/png;example_id,0"

    payload = {
        "prompt": prompt,
        "image": data_url,
        "aspect_ratio": aspect_ratio,
        "steps": steps,
        "cfg_scale": cfg_scale,
        "seed": seed,
    }

    print(f"  POST {MODEL_URL} (steps={steps}, ar={aspect_ratio})...", flush=True)
    resp = requests.post(MODEL_URL, headers=headers, json=payload, timeout=180)

    if resp.status_code != 200:
        print(f"  HTTP {resp.status_code} ERRO: {resp.text[:500]}")
        return None

    result = resp.json()
    if "artifacts" in result and len(result["artifacts"]) > 0:
        return result["artifacts"][0].get("base64")
    print(f"  Sem imagem na resposta")
    return None
