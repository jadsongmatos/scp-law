#!/usr/bin/env python3
"""Regenera mapas usando flux.1-kontext-dev com prompts detalhados do estilo wireframe noir 3D."""
import base64
import os
import sys
import time
import requests
from pathlib import Path

MODEL_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
MAP_DIR = Path("src/assets/images/noir/maps")

# Estilo exato do map_armazem.png - 3D wireframe perspective
STYLE = (
    "3D perspective wireframe interior view, NOT flat top-down, NOT isometric, "
    "dark black background with subtle dark green tint, "
    "thin glowing neon wireframe outlines, "
    "GREEN wireframe lines for walls, ceiling beams, floor edges, structural elements, "
    "AMBER/GOLD wireframe lines for furniture, objects, crates, equipment, "
    "warm amber glow light source from single hanging bulb, "
    "industrial technical blueprint aesthetic, "
    "dark moody atmosphere with subtle green ambient light, "
    "security surveillance camera perspective looking down into room, "
    "high contrast, detailed individual objects as wireframe outlines, "
    "cinematic noir atmosphere, "
    "NO solid fills, NO textures, NO people, NO text, "
    "pure wireframe line art on dark background"
)

MAPS = [
    ("map_igreja.png", 42,
     STYLE + "Old stone church interior at night. "
     "Rows of wooden pews as amber wireframe, altar table at front with cross outline, "
     "stained glass window as green wireframe arch, confessional booth in corner, "
     "high vaulted ceiling with green wireframe beams, "
     "candlelight amber glow, incense smoke haze."),
    ("map_fazenda.png", 43,
     STYLE + "Rural farmhouse property at dusk. "
     "Main house as green wireframe outline, wooden barn with roof beams, "
     "dirt road path, fenced pasture with wireframe fence posts, "
     "old tractor as amber wireframe, single warm light in farmhouse window, "
     "gray cloudy sky above, isolated and quiet."),
    ("map_hospital.png", 44,
     STYLE + "Small district hospital waiting room at night. "
     "Empty plastic chairs as amber wireframe, reception desk with glass partition, "
     "corridor with fluorescent light flickering, examination room, "
     "emergency exit door, linoleum floor, "
     "sterile cold atmosphere with green ambient light."),
    ("map_casa_mae.png", 45,
     STYLE + "Modest house living room at night. "
     "Worn armchair and sofa as amber wireframe, wooden table with handwritten letter, "
     "family photographs on shelf as small amber rectangles, old radio, "
     "kitchen doorway visible, warm lamp light, "
     "melancholic intimate atmosphere."),
    ("map_bar.png", 46,
     STYLE + "Smoky dive bar interior at night. "
     "Long L-shaped wooden counter as amber wireframe, booth seating along wall, "
     "jukebox in corner, neon sign outline, dim lamp on counter, "
     "cigarette smoke haze, warm amber/red lighting, "
     "deep shadows, bar Vila Nova atmosphere."),
    ("map_beco.png", 47,
     STYLE + "Dark alley at night, heavy rain. "
     "Narrow corridor between brick walls as green wireframe, fire escapes on walls, "
     "overflowing dumpster as amber wireframe, flickering bulb, "
     "steam rising from sewer grate, stray cat on fire escape, "
     "claustrophobic, figure-sized shadow cast on wall."),
    ("map_escola.png", 48,
     STYLE + "Empty school hallway at night. "
     "Lockers along walls as amber wireframe, bulletin board, classroom doors, "
     "one broken window, water fountain, red EXIT sign outline, "
     "flickering fluorescent lights, eerie atmosphere, "
     " Volksschule school interior."),
    ("map_rua_chuva.png", 49,
     STYLE + "Rain-soaked street at night. "
     "Wet asphalt reflecting neon signs, flickering streetlamp, "
     "fire escapes on brick walls as green wireframe, "
     "pharmacy sign, bar Vila Nova outline, pawn shop, "
     "puddles everywhere, moody noir street scene."),
]


def generate(prompt: str, seed: int, steps: int = 50, cfg: float = 5.0) -> str | None:
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
            print(f"  HTTP {resp.status_code}: {resp.text[:300]}")
            return None
        result = resp.json()
        if "artifacts" in result and len(result["artifacts"]) > 0:
            return result["artifacts"][0].get("base64")
        print(f"  Sem artifacts")
        return None
    except Exception as e:
        print(f"  Exception: {e}")
        return None


def main():
    if not NVIDIA_API_KEY:
        print("ERRO: Defina NVIDIA_API_KEY")
        sys.exit(1)

    print("=" * 60)
    print(f"flux.1-kontext-dev: {len(MAPS)} mapas wireframe noir 3D")
    print("=" * 60)

    ok = fail = 0
    for i, (fname, seed, prompt) in enumerate(MAPS, 1):
        out = MAP_DIR / fname
        print(f"\n[{i}/{len(MAPS)}] {fname} (seed={seed})")
        b64 = generate(prompt, seed=seed, steps=50, cfg=5.0)
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
