#!/usr/bin/env python3
"""
Gerador de imagens noir para o jogo Murphy Law.
1. Gera imagem raiz (escritorio) via text-to-image
2. Usa a imagem raiz como referência para editar/gerar as demais salas
3. Gera miniaturas de mapa a partir das imagens de sala

Modelo: google/gemini-3-pro-image-preview (via OpenRouter)
"""

import base64
import sys
import time

from scripts.shared.config import (
    NOIR_IMAGE_DIR,
    NOIR_MAP_DIR,
    NOIR_STYLE_PREFIX,
)
from scripts.shared.openrouter import generate_image, save_image
from scripts.shared.ipv4_fix import force_ipv4

ROOMS = {
    "escritorio": {
        "prompt": f"""{NOIR_STYLE_PREFIX}

Generate a first-person view of a rundown private detective's office at night. Rain streaks down the single window on the left wall.
A battered wooden desk dominates the center with piles of case files, a half-empty whiskey bottle, and a tarnished brass lamp casting a warm amber pool of light.
The desk chair is pushed back. On the right wall, a filing cabinet with a drawer slightly open.
The ceiling has a water stain and a bare bulb. Cigarette butts in an ashtray.
The door is visible at the far end with a frosted glass panel reading "MURPHY LAW" (the A is missing).
Deep shadows in corners. Film noir atmosphere. Warm amber from the lamp, cold blue from the window rain.""",
        "first": True,
    },
    "rua_chuva": {
        "prompt": f"""{NOIR_STYLE_PREFIX}

Edit this image: Transform the scene into a rain-soaked street at night, as if stepping out of the detective's office doorway.
The office door is behind the viewer. Wet asphalt reflecting red and blue neon signs — a pharmacy, a bar called "Vila Nova", a pawn shop.
Rain is falling heavily. A flickering streetlamp casts a cone of yellow light. Puddles everywhere.
Fire escape zigzagging up a brick wall on the left. A newspaper blowing in the wind. Distant silhouette of buildings.
No people visible. Deep noir atmosphere — chiaroscuro lighting, wet surfaces, urban decay.""",
    },
    "bar": {
        "prompt": f"""{NOIR_STYLE_PREFIX}

Edit this image: Transform the scene into the interior of a smoky dive bar called "Bar Vila Nova" at night.
A long wooden bar counter on the left with bottles on shelves, a neon sign behind the bar glowing amber.
A few bar stools. A booth in the far right corner with a dim overhead lamp.
Cigarette smoke haze visible in the light beams. A vintage jukebox against the wall.
Wood paneling, worn leather seats. The bar counter has an ashtray and a half-drunk glass.
Warm amber and red lighting. Deep shadows in the corners. No people. Noir atmosphere.""",
    },
    "escola": {
        "prompt": f"""{NOIR_STYLE_PREFIX}

Edit this image: Transform the scene into an empty school hallway at night.
Fluorescent lights flicker overhead, casting a sickly green-white glow on scuffed linoleum floors.
Lockers line both walls — some dented, one slightly open. Bulletin board with faded notices.
A water fountain on the right wall. Classroom doors along the corridor, one has a broken window.
At the far end, the principal's office door with a brass nameplate. Shadows are deep and unsettling.
The atmosphere is institutional, cold, and eerie. A single red "EXIT" sign glows at the end.
No people. Noir horror-detective atmosphere.""",
    },
    "diretoria": {
        "prompt": f"""{NOIR_STYLE_PREFIX}

Edit this image: Transform the scene into a school principal's office at night.
A heavy wooden desk with a leather chair behind it. Bookshelves with law manuals and education codes.
Framed certificates on the wall — one is crooked. A filing cabinet with a lock.
A window with blinds partially open, letting in moonlight. A small plant on the windowsill, wilting.
On the desk: a phone, scattered papers, a nameplate reading "Diretora Elvira Costa".
A side table with a coffee mug and an ashtray. The room smells of old paper and secrets.
Warm amber desk lamp, cold moonlight from window. Deep shadows. No people. Noir atmosphere.""",
    },
    "delegacia": {
        "prompt": f"""{NOIR_STYLE_PREFIX}

Edit this image: Transform the scene into a run-down police precinct interior at night.
A front desk/bulletproof glass window on the left. Rows of wooden benches in the waiting area.
Filing cabinets against the wall — one drawer hanging open. A water cooler.
On the wall: a bulletin board with suspect photos and case numbers, some circled in red.
Fluorescent lighting, one bulb flickering. A hallway leading to interrogation rooms in the back.
A "MISSING PERSONS" poster board with several faces — one photo is highlighted.
Institutional green walls, scuffed floor. No people. Oppressive, corrupt atmosphere. Noir.""",
    },
    "beco": {
        "prompt": f"""{NOIR_STYLE_PREFIX}

Edit this image: Transform the scene into a dark alleyway at night, rain pouring.
Brick walls on both sides, fire escape ladders zigzagging up. A dumpster overflowing.
A single flickering bulb above a back door. Rain creates rivers along the cracked pavement.
Graffiti on the wall — a faded message. Puddles reflecting the dim light.
At the far end, a figure-sized shadow (not a person, just a shadow cast on the wall).
A stray cat sitting on a fire escape. Steam rising from a grate.
Oppressive darkness, claustrophobic. Chiaroscuro. Noir atmosphere. No people visible.""",
    },
    "armazem": {
        "prompt": f"""{NOIR_STYLE_PREFIX}

Edit this image: Transform the scene into the interior of an abandoned warehouse at night.
Vast space with high ceilings, exposed metal beams and rusted supports.
Wooden crates stacked along the walls. A forklift parked in the corner, covered in dust.
A single bare bulb hanging from a chain, swinging slightly. Large industrial doors at the far end, one slightly ajar with moonlight bleeding through.
On the floor: scattered papers, a broken chair, drag marks in the dust.
A metal stairway leading to a catwalk overhead. Cobwebs in the corners.
Ominous, cavernous atmosphere. Industrial noir. Deep shadows. No people.""",
    },
}

ROOM_ORDER = [
    "escritorio",
    "rua_chuva",
    "bar",
    "escola",
    "diretoria",
    "delegacia",
    "beco",
    "armazem",
]


def generate_map_thumbnail(room_b64: str, room_name: str, aspect_ratio: str = "4:3") -> str | None:
    prompt = f"""{NOIR_STYLE_PREFIX}

Using this room image as reference, generate a small top-down mini-map view of this location ({room_name}).
It should look like a stylized floor plan or bird's-eye schematic view. Simple, clean lines.
Dark background with subtle green/amber outlines showing the room layout.
Like a security camera or thermal imaging view. Minimalist. No people.
Keep the noir aesthetic but make it look like a map/diagram."""

    return generate_image(prompt, reference_image_b64=room_b64, aspect_ratio=aspect_ratio)


def main():
    force_ipv4()

    NOIR_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    NOIR_MAP_DIR.mkdir(parents=True, exist_ok=True)

    root_b64 = None
    generated = {}

    print("=" * 60)
    print("PHASE 1: Generating root image (escritorio)")
    print("=" * 60)

    room = ROOM_ORDER[0]
    config = ROOMS[room]
    print(f"\n[{room}] Generating from text prompt...")
    img_b64 = generate_image(config["prompt"])

    if img_b64:
        filepath = NOIR_IMAGE_DIR / f"bg_{room}.png"
        if save_image(img_b64, filepath):
            root_b64 = img_b64
            generated[room] = filepath
            print(f" ROOT IMAGE READY ✓")
        else:
            print(" FATAL: Could not save root image. Aborting.")
            sys.exit(1)
    else:
        print(" FATAL: Could not generate root image. Aborting.")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("PHASE 2: Generating other rooms (editing from root)")
    print("=" * 60)

    for room in ROOM_ORDER[1:]:
        config = ROOMS[room]
        print(f"\n[{room}] Generating with root reference...")
        img_b64 = generate_image(config["prompt"], reference_image_b64=root_b64)

        if img_b64:
            filepath = NOIR_IMAGE_DIR / f"bg_{room}.png"
            if save_image(img_b64, filepath):
                generated[room] = filepath
            else:
                print(f" WARNING: Failed to save {room}, will try without reference...")
                img_b64_fallback = generate_image(config["prompt"])
                if img_b64_fallback:
                    filepath = NOIR_IMAGE_DIR / f"bg_{room}.png"
                    if save_image(img_b64_fallback, filepath):
                        generated[room] = filepath
        else:
            print(f" WARNING: Failed with reference, trying without...")
            img_b64_fallback = generate_image(config["prompt"])
            if img_b64_fallback:
                filepath = NOIR_IMAGE_DIR / f"bg_{room}.png"
                if save_image(img_b64_fallback, filepath):
                    generated[room] = filepath

        time.sleep(2)

    print("\n" + "=" * 60)
    print("PHASE 3: Generating map thumbnails")
    print("=" * 60)

    for room, room_config in ROOMS.items():
        if room not in generated:
            print(f"\n[{room}] SKIPPED — no bg image available")
            continue

        print(f"\n[{room}] Generating map thumbnail...")
        room_name = room_config["prompt"].split("Transform the scene into")[-1].split(".")[0].strip() if "Transform" in room_config["prompt"] else "Escritório de Murphy Law"

        bg_path = generated[room]
        room_b64 = base64.b64encode(bg_path.read_bytes()).decode("utf-8")

        map_b64 = generate_map_thumbnail(room_b64, room_name, aspect_ratio="4:3")

        if map_b64:
            map_path = NOIR_MAP_DIR / f"map_{room}.png"
            if save_image(map_b64, map_path):
                print(f" Map thumbnail saved ✓")
        else:
            print(f" WARNING: Could not generate map for {room}")

        time.sleep(2)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"\nRoom backgrounds generated: {len(generated)}/8")
    for room, path in generated.items():
        print(f" ✓ {room}: {path}")

    map_count = len(list(NOIR_MAP_DIR.glob("map_*.png")))
    print(f"\nMap thumbnails generated: {map_count}/8")

    if len(generated) < 8:
        print(f"\n⚠ Missing rooms: {set(ROOM_ORDER) - set(generated.keys())}")
        print(" Re-run the script to retry failed rooms.")
    else:
        print("\n✓ All room images generated successfully!")


if __name__ == "__main__":
    main()
