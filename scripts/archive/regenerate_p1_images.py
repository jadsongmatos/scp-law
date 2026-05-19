#!/usr/bin/env python3
"""
Regenerates 4 background images with corrected signage text (P1 fixes).
- rua_chuva: "BAR VILA NOVA" → "GASTHOF", "LOJA DE PENHORES" → "PFANDHAUS"
- escola: "PRINCIPAL" → "DIRETORIA"
- delegacia: "INTERROGATION" → "VERNHAMMUNG"
- bar: "BAR VILA NOVA" → "GASTHOF"

ARQUIVO MORTO — One-off script for P1 signage fixes.
"""

import os
import sys
import time
from pathlib import Path

from scripts.shared.config import (
    OPENROUTER_API_KEY, NOIR_IMAGE_DIR, NOIR_MAP_DIR,
    NOIR_STYLE_PREFIX, IMAGE_MODEL, OPENROUTER_API_URL,
)
from scripts.shared.openrouter import generate_image, save_image
from scripts.shared.ipv4_fix import force_ipv4

ROOT_IMG = NOIR_IMAGE_DIR / "bg_escritorio.png"

ROOMS = {
    "rua_chuva": {
        "prompt": f"""{NOIR_STYLE_PREFIX}

Generate a first-person view of a rain-soaked street at night, as if stepping out of a doorway.
Wet asphalt reflecting red and blue neon signs. On the LEFT building: a pharmacy with a neon sign reading "FARMÁCIA" in green.
On the RIGHT building: a vertical neon sign reading "GASTHOF" in flickering red/blue — this is a dive bar/guesthouse.
Further right: a yellow illuminated sign reading "PFANDHAUS" (pawnshop in German) above a dark storefront.
Rain is falling heavily. A flickering streetlamp casts a cone of yellow light. Puddles everywhere.
Fire escape zigzagging up a brick wall on the left. A newspaper blowing in the wind. Distant silhouette of buildings.
No people visible. Deep noir atmosphere — chiaroscuro lighting, wet surfaces, urban decay. Soviet-era decay everywhere."""
    },
    "bar": {
        "prompt": f"""{NOIR_STYLE_PREFIX}

Generate a first-person view of the interior of a smoky dive bar/guesthouse called "Gasthof" at night.
A long wooden bar counter on the left with bottles on shelves, a neon sign behind the bar reading "GASTHOF" glowing amber.
A few bar stools. A booth in the far right corner with a dim overhead lamp.
Cigarette smoke haze visible in the light beams. A vintage jukebox against the wall.
Wood paneling, worn leather seats. The bar counter has an ashtray and a half-drunk glass.
Warm amber and red lighting. Deep shadows in the corners. No people. Noir atmosphere.
On the wall near the door, a small red neon sign reading "OFFEN" (German for OPEN)."""
    },
    "escola": {
        "prompt": f"""{NOIR_STYLE_PREFIX}

Generate a first-person view of an empty school hallway at night.
Fluorescent lights flicker overhead, casting a sickly green-white glow on scuffed linoleum floors.
Lockers line both walls — some dented, one slightly open. Bulletin board with faded notices.
A water fountain on the right wall. Classroom doors along the corridor, one has a broken window.
At the far end, a door with a brass nameplate reading "DIRETORIA" (Portuguese for Principal's Office).
Shadows are deep and unsettling. The atmosphere is institutional, cold, and eerie.
A single red "AUSGANG" sign (German for EXIT) glows at the end. Soviet-era institutional decay.
No people. Noir horror-detective atmosphere."""
    },
    "delegacia": {
        "prompt": f"""{NOIR_STYLE_PREFIX}

Generate a first-person view of a run-down police precinct interior at night.
A front desk/bulletproof glass window on the left. Rows of wooden benches in the waiting area.
Filing cabinets against the wall — one drawer hanging open. A water cooler.
On the wall: a bulletin board with suspect photos and case numbers, some circled in red.
Fluorescent lighting, one bulb flickering. A hallway leading to rooms in the back —
the first door has a sign reading "VERNHAMMUNG" (German for Interrogation).
A "VERMISSTE PERSONEN" (Missing Persons) poster board with several faces — one photo highlighted.
Institutional green walls, scuffed floor. No people. Oppressive, corrupt atmosphere. Noir.
Soviet-era institutional decay — cracked walls, peeling paint, nothing works properly."""
    },
}


def generate_map_thumbnail(room_b64, room_name, aspect_ratio="4:3"):
    prompt = f"""{NOIR_STYLE_PREFIX}

Using this room image as reference, generate a small top-down mini-map view of this location ({room_name}).
It should look like a stylized floor plan or bird's-eye schematic view. Simple, clean lines.
Dark background with subtle green/amber outlines showing the room layout.
Like a security camera or thermal imaging view. Minimalist. No people.
Keep the noir aesthetic but make it look like a map/diagram."""
    return generate_image(prompt, reference_image_b64=room_b64, aspect_ratio=aspect_ratio)


def main():
    force_ipv4()

    if not ROOT_IMG.exists():
        print("FATAL: Root image bg_escritorio.png not found. Cannot use as reference.")
        sys.exit(1)

    import base64
    root_b64 = base64.b64encode(ROOT_IMG.read_bytes()).decode("utf-8")
    print(f"Loaded root image: {ROOT_IMG} ({ROOT_IMG.stat().st_size / 1024:.0f} KB)")

    generated = []

    for room, config in ROOMS.items():
        print(f"\n{'='*60}")
        print(f"[{room}] Regenerating with corrected signs...")
        print(f"{'='*60}")

        img_b64 = generate_image(config["prompt"], reference_image_b64=root_b64)

        if not img_b64:
            print(f" Trying without reference image...")
            img_b64 = generate_image(config["prompt"])

        if img_b64:
            filepath = NOIR_IMAGE_DIR / f"bg_{room}.png"
            if save_image(img_b64, filepath, backup=True):
                generated.append(room)

                print(f" Generating map thumbnail...")
                map_b64 = generate_map_thumbnail(img_b64, room)
                if map_b64:
                    map_path = NOIR_MAP_DIR / f"map_{room}.png"
                    save_image(map_b64, map_path, backup=True)
                else:
                    print(f" WARNING: Could not generate map for {room}")
            else:
                print(f" FAILED to save {room}")
        else:
            print(f" FAILED to generate {room}")

        time.sleep(3)

    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Regenerated: {len(generated)}/4 rooms")
    for r in generated:
        print(f" ✓ {r}")
    missing = set(ROOMS.keys()) - set(generated)
    if missing:
        print(f" ⚠ Missing: {missing}")
        print(" Re-run to retry.")


if __name__ == "__main__":
    main()
