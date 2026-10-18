#!/usr/bin/env python3
"""
Gera 8 mapas noir usando flux.1-kontext-dev (text-to-image puro).
Prompts ultra-detalhados descrevendo o estilo wireframe 3D do map_armazem.png.
"""
import base64
import os
import sys
import time
import requests
from pathlib import Path

MODEL_URL = "https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-kontext-dev"
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
MAP_DIR = Path("src/assets/images/noir/maps")


def generate(prompt: str, seed: int, steps: int = 50, cfg: float = 7.0) -> bytes | None:
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
            print(f"  HTTP {resp.status_code}: {resp.text[:200]}")
            return None
        result = resp.json()
        if "artifacts" in result and len(result["artifacts"]) > 0:
            b64 = result["artifacts"][0].get("base64")
            if b64:
                return base64.b64decode(b64)
        print(f"  Sem artifacts")
        return None
    except Exception as e:
        print(f"  Exception: {e}")
        return None


# Prompts ultra-detalhados descrevendo o estilo exato
MAPS = [
    ("map_igreja.png", 501,
     "3D wireframe perspective view looking down into a church interior at night. "
     "Dark black background with subtle deep green ambient glow. "
     "Thin glowing neon wireframe outlines defining every object. "
     "GREEN wireframe lines for stone walls, arched ceiling beams, floor tiles, column pillars. "
     "AMBER/GOLD wireframe lines for wooden pews arranged in two rows, altar table with cross, "
     "confessional booth, candle holders, stained glass window frame. "
     "Single warm amber light source from hanging lantern casting soft glow. "
     "High vaulted ceiling with green wireframe ribbed vaulting. "
     "Security camera perspective from above looking down. "
     "Detailed wireframe: each pew plank, each candle, each stone block visible as line art. "
     "Cinematic noir atmosphere, moody, dark. "
     "NO solid fills, NO textures, NO people, NO text, NO flat 2D. "
     "Pure wireframe line art on dark background."),

    ("map_fazenda.png", 502,
     "3D wireframe perspective view of rural farmhouse property at dusk. "
     "Dark black background with subtle dark green tint. "
     "Thin glowing neon wireframe outlines. "
     "GREEN wireframe lines for main house walls, roof beams, barn structure, fence posts, wooden gates. "
     "AMBER/GOLD wireframe lines for tractor, water well, hay bales, tools, window frames. "
     "Single warm amber light glowing in farmhouse window. "
     "Dirt road path as faint green wireframe line leading to barn. "
     "Fenced pasture with wireframe fence posts and wire. "
     "Gray cloudy sky suggested by faint green wireframe clouds. "
     "Security camera aerial perspective. "
     "Detailed wireframe: each fence slat, each roof shingle, tractor wheels visible. "
     "Isolated rural atmosphere, quiet noir mood. "
     "NO solid fills, NO textures, NO people, NO text. "
     "Pure wireframe line art on dark background."),

    ("map_hospital.png", 503,
     "3D wireframe perspective view looking down into small hospital waiting room at night. "
     "Dark black background with cold green ambient glow. "
     "Thin glowing neon wireframe outlines. "
     "GREEN wireframe lines for walls, corridor, door frames, ceiling tiles, fluorescent light fixtures. "
    "AMBER/GOLD wireframe lines for plastic waiting chairs in rows, reception desk with glass partition, "
     "bulletin board, water cooler, examination table, medical equipment. "
     "Flickering fluorescent light suggested by varying green wireframe brightness. "
     "Sterile cold atmosphere with green tint. "
     "Security camera perspective from ceiling corner. "
     "Detailed wireframe: each chair leg, each tile, desk drawers visible as line art. "
     "Quiet eerie hospital at night, noir mood. "
     "NO solid fills, NO textures, NO people, NO text. "
     "Pure wireframe line art on dark background."),

    ("map_casa_mae.png", 504,
     "3D wireframe perspective view looking down into modest house living room at night. "
     "Dark black background with warm amber ambient glow. "
     "Thin glowing neon wireframe outlines. "
     "GREEN wireframe lines for walls, door frame to kitchen, window, ceiling, floor boards. "
     "AMBER/GOLD wireframe lines for worn armchair, sofa, wooden dining table, "
     "family photographs on shelf as small rectangles, old radio, table lamp, "
     "handwritten letter on table, kitchen doorway visible. "
     "Warm amber lamp light casting soft glow on furniture wireframes. "
     "Intimate melancholic atmosphere. "
     "Security camera perspective from corner above. "
     "Detailed wireframe: armchair cushions, table legs, photo frames, radio dials visible. "
     "Cozy but sad noir domestic scene. "
     "NO solid fills, NO textures, NO people, NO text. "
     "Pure wireframe line art on dark background."),

    ("map_bar.png", 505,
     "3D wireframe perspective view looking down into smoky dive bar interior at night. "
     "Dark black background with warm amber and red ambient glow. "
     "Thin glowing neon wireframe outlines. "
     "GREEN wireframe lines for walls, ceiling beams, floor tiles, back bar shelves, door frame. "
     "AMBER/GOLD wireframe lines for long L-shaped wooden counter, bar stools, "
     "booth seating along wall, jukebox in corner, neon sign frame, "
     "bottles on shelves, dim table lamp, cigarette smoke haze as faint wireframe wisps. "
     "Warm amber/red lighting from neon and lamps. "
     "Security camera perspective from above. "
     "Detailed wireframe: each bottle, stool, booth cushion, jukebox details visible. "
     "Smoky noir bar atmosphere, deep shadows. "
     "NO solid fills, NO textures, NO people, NO text. "
     "Pure wireframe line art on dark background."),

    ("map_beco.png", 506,
     "3D wireframe perspective view of dark alley at night, heavy rain. "
     "Dark black background with green ambient glow. "
     "Thin glowing neon wireframe outlines. "
     "GREEN wireframe lines for tall brick walls on both sides, fire escape stairs zigzagging up walls, "
     "cobblestone ground, sewer grate, building edges. "
    "AMBER/GOLD wireframe lines for overflowing dumpster, flickering bare bulb hanging from wire, "
     "steam rising from grate as swirling wireframe wisps, stray cat silhouette on fire escape. "
     "Single warm amber light from bulb casting long green wireframe shadows. "
     "Claustrophobic narrow corridor perspective. "
     "Security camera perspective looking down the alley. "
     "Detailed wireframe: each brick, each fire escape rung, dumpster lid visible. "
    "Dark noir alley atmosphere, rain-slicked surfaces. "
     "NO solid fills, NO textures, NO people, NO text. "
     "Pure wireframe line art on dark background."),

    ("map_escola.png", 507,
     "3D wireframe perspective view looking down empty school hallway at night. "
     "Dark black background with cold green fluorescent glow. "
     "Thin glowing neon wireframe outlines. "
     "GREEN wireframe lines for walls, ceiling, floor tiles, locker rows, classroom doors, "
     "bulletin board, water fountain, EXIT sign frame. "
     "AMBER/GOLD wireframe lines for desk inside classroom visible through door, "
     "chair, chalkboard, clock on wall, broken window frame. "
     "Flickering fluorescent light suggested by green wireframe tubes on ceiling. "
     "Eerie empty school atmosphere at night. "
     "Security camera perspective from ceiling at end of hallway. "
     "Detailed wireframe: each locker door, each tile, door handles visible. "
     "Volksschule school noir atmosphere. "
     "NO solid fills, NO textures, NO people, NO text. "
     "Pure wireframe line art on dark background."),

    ("map_rua_chuva.png", 508,
     "3D wireframe perspective view of rain-soaked street at night. "
     "Dark black background with green and amber ambient glow. "
     "Thin glowing neon wireframe outlines. "
     "GREEN wireframe lines for brick building facades on both sides, fire escapes, "
     "window frames, door frames, roof edges. "
     "AMBER/GOLD wireframe lines for neon pharmacy cross sign, bar Vila Nova awning, "
     "pawn shop window display, street lamp post, puddle reflections as shimmering wireframe circles, "
     "wet asphalt surface with reflected light lines. "
     "Flickering streetlamp casting amber glow on wet ground. "
     "Steam from manhole as swirling wireframe wisps. "
     "Wide street perspective looking down the road. "
     "Security camera perspective from building corner above. "
     "Detailed wireframe: each brick, each sign letter frame, each puddle ripple visible. "
     "Moody noir street scene, rain everywhere. "
     "NO solid fills, NO textures, NO people, NO text. "
     "Pure wireframe line art on dark background."),
]


def main():
    if not NVIDIA_API_KEY:
        print("ERRO: Defina NVIDIA_API_KEY")
        sys.exit(1)

    print("=" * 60)
    print(f"flux.1-kontext-dev text-to-image: {len(MAPS)} mapas")
    print("Prompts ultra-detalhados estilo wireframe noir 3D")
    print("=" * 60)

    ok = fail = 0
    for i, (fname, seed, prompt) in enumerate(MAPS, 1):
        out = MAP_DIR / fname
        print(f"\n[{i}/{len(MAPS)}] {fname} (seed={seed})")
        img = generate(prompt, seed=seed, steps=50, cfg=7.0)
        if img:
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
