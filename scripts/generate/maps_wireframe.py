#!/usr/bin/env python3
"""Regenera 8 mapas ruins usando text-to-image via flux.1-kontext-dev (sem imagem de referencia)."""
import base64
import os
import sys
import time
import requests
from pathlib import Path

MODEL_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
MAP_DIR = Path("src/assets/images/noir/maps")

# Estilo wireframe noir igual map_diretoria.png
STYLE = (
    "Top-down floor plan blueprint map, dark black background, "
    "thin glowing amber-gold wireframe outlines, minimalist technical schematic, "
    "no 3D, no isometric view, no cartoon, no bright colors, "
    "flat 2D overhead security camera view, "
    "monochrome amber on black, "
    "no people, no text, no perspective, "
    "Vogonese engineering diagram aesthetic, "
    "police surveillance blueprint style. "
)

MAPS = [
    ("map_igreja.png",
     STYLE + "Church interior: rectangular nave, rows of wooden pews, altar at front, two side aisles, stained glass windows along walls, confessional booth in corner, entrance door at back."),
    ("map_fazenda.png",
     STYLE + "Rural farmhouse property: main house rectangle, adjacent barn, dirt road connecting them, fenced pasture area, small tractor shed, well, surrounding fence perimeter."),
    ("map_hospital.png",
     STYLE + "Small hospital floor plan: waiting room with chairs, reception desk, corridor, examination room, emergency exit, restroom, nurses station."),
    ("map_casa_mae.png",
     STYLE + "Modest house floor plan: living room with sofa, dining table, kitchen doorway, hallway, bedroom, family photos on wall, radio on shelf."),
    ("map_bar.png",
     STYLE + "Dive bar interior: long L-shaped wooden counter, booth seating along wall, jukebox corner, entrance, restroom, storage room, stage area."),
    ("map_beco.png",
     STYLE + "Dark alley: narrow L-shaped corridor between brick walls, dumpster, fire escape stairs, sewer grate, dead end, street entrance."),
    ("map_escola.png",
     STYLE + "School floor plan: long hallway, lockers along walls, classroom doors, bathroom, staff room, exit door, water fountain."),
    ("map_rua_chuva.png",
     STYLE + "Street at night: long road, sidewalks, buildings on both sides, pharmacy, bar, pawn shop, street lamps, fire escapes, puddles."),
]


def generate_text_to_image(prompt: str, steps: int = 50, cfg: float = 5.0, seed: int = 0) -> str | None:
    if not NVIDIA_API_KEY:
        print("ERRO: NVIDIA_API_KEY not set")
        return None

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    payload = {
        "prompt": prompt,
        "image": "data:image/png;example_id,0",
        "width": 1024,
        "height": 1024,
        "cfg_scale": cfg,
        "seed": seed,
        "steps": steps,
    }

    try:
        resp = requests.post(MODEL_URL, headers=headers, json=payload, timeout=180)
        if resp.status_code != 200:
            print(f"  HTTP {resp.status_code}: {resp.text[:400]}")
            return None
        result = resp.json()
        if "artifacts" in result and len(result["artifacts"]) > 0:
            return result["artifacts"][0].get("base64")
        print(f"  Sem artifacts: {list(result.keys())}")
        return None
    except Exception as e:
        print(f"  Exception: {e}")
        return None


def main():
    if not NVIDIA_API_KEY:
        print("ERRO: Defina NVIDIA_API_KEY")
        sys.exit(1)

    print("=" * 60)
    print(f"Text-to-image: {len(MAPS)} mapas (wireframe noir)")
    print("=" * 60)

    ok = fail = 0
    for i, (fname, prompt) in enumerate(MAPS, 1):
        out = MAP_DIR / fname
        print(f"\n[{i}/{len(MAPS)}] {fname}")
        b64 = generate_text_to_image(prompt, seed=i*10)
        if b64:
            img = base64.b64decode(b64)
            out.write_bytes(img)
            print(f"  OK ({len(img)//1024} KB)")
            ok += 1
        else:
            print("  FALHA")
            fail += 1
        if i < len(MAPS):
            time.sleep(5)

    print(f"\nConcluido: {ok} OK, {fail} FALHA")


if __name__ == "__main__":
    main()
