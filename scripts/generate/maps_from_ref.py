#!/usr/bin/env python3
"""Regenera mapas usando NVIDIA flux com map_diretoria.png como referência de estilo."""
import base64
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
MODEL_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"
REF_IMAGE = Path("src/assets/images/noir/maps/map_diretoria.png")
MAP_DIR = Path("src/assets/images/noir/maps")

import requests

MAPS = [
    ("map_igreja.png", "Transform this floor plan into a CHURCH interior: wooden pews in rows, altar at front, stained glass window, confessional booth. Keep the exact same wireframe noir style - dark background, amber/gold neon outlines, minimalist blueprint aesthetic."),
    ("map_fazenda.png", "Transform this floor plan into a RURAL FARMHOUSE property: main house outline, dirt road, wooden barn, fenced pasture, tractor silhouette. Keep the exact same wireframe noir style - dark background, amber/gold neon outlines, minimalist blueprint aesthetic."),
    ("map_hospital.png", "Transform this floor plan into a SMALL HOSPITAL: waiting room with plastic chairs, reception window, corridor, emergency exit. Keep the exact same wireframe noir style - dark background, green/amber neon outlines, minimalist blueprint aesthetic."),
    ("map_casa_mae.png", "Transform this floor plan into a MODEST HOUSE LIVING ROOM: family photographs, wooden table with letter, old radio, worn armchair, kitchen doorway. Keep the exact same wireframe noir style - dark background, amber/gold neon outlines, minimalist blueprint aesthetic."),
    ("map_bar.png", "Transform this floor plan into a DIVE BAR: long wooden counter, booth seating, jukebox, neon sign, dim lamp. Keep the exact same wireframe noir style - dark background, amber/gold neon outlines, minimalist blueprint aesthetic."),
    ("map_beco.png", "Transform this floor plan into a DARK ALLEY: brick walls, fire escapes, dumpster, flickering bulb, steam from grate. Keep the exact same wireframe noir style - dark background, green/amber neon outlines, minimalist blueprint aesthetic."),
    ("map_escola.png", "Transform this floor plan into a SCHOOL HALLWAY: lockers, bulletin board, classroom doors, broken window, water fountain. Keep the exact same wireframe noir style - dark background, green neon outlines, minimalist blueprint aesthetic."),
    ("map_rua_chuva.png", "Transform this floor plan into a RAIN-SOAKED STREET: wet asphalt, neon signs, flickering streetlamp, fire escapes, pharmacy sign, bar outline. Keep the exact same wireframe noir style - dark background, amber/green neon outlines, minimalist blueprint aesthetic."),
]


def generate_with_reference(prompt: str, ref_path: Path) -> str | None:
    if not NVIDIA_API_KEY:
        print("ERRO: NVIDIA_API_KEY not set")
        return None

    img_b64 = base64.b64encode(ref_path.read_bytes()).decode()
    data_url = f"data:image/png;base64,{img_b64}"

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    payload = {
        "prompt": prompt,
        "image": data_url,
        "aspect_ratio": "match_input_image",
        "steps": 50,
        "cfg_scale": 5.0,
        "seed": 0,
    }

    resp = requests.post(MODEL_URL, headers=headers, json=payload, timeout=180)

    if resp.status_code != 200:
        print(f"  HTTP {resp.status_code}: {resp.text[:300]}")
        return None

    result = resp.json()
    if "artifacts" in result and len(result["artifacts"]) > 0:
        return result["artifacts"][0].get("base64")
    print(f"  Sem imagem na resposta: {list(result.keys())}")
    return None


def main():
    if not REF_IMAGE.exists():
        print(f"ERRO: Referencia nao encontrada: {REF_IMAGE}")
        sys.exit(1)

    print("=" * 60)
    print(f"Regenerando {len(MAPS)} mapas com estilo de {REF_IMAGE.name}")
    print("=" * 60)

    ok = 0
    fail = 0

    for i, (filename, prompt) in enumerate(MAPS, 1):
        out_path = MAP_DIR / filename
        print(f"\n[{i}/{len(MAPS)}] {filename}")

        img_b64 = generate_with_reference(prompt, REF_IMAGE)
        if img_b64:
            img_bytes = base64.b64decode(img_b64)
            out_path.write_bytes(img_bytes)
            print(f"  OK ({len(img_bytes) // 1024} KB)")
            ok += 1
        else:
            print(f"  FALHA")
            fail += 1

        if i < len(MAPS):
            time.sleep(5)

    print("\n" + "=" * 60)
    print(f"Concluido: {ok} OK, {fail} FALHA")
    print("=" * 60)


if __name__ == "__main__":
    main()
