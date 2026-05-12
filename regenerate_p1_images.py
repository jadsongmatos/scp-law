#!/usr/bin/env python3
"""
Regenerates 4 background images with corrected signage text (P1 fixes).
- rua_chuva: "BAR VILA NOVA" → "GASTHOF", "LOJA DE PENHORES" → "PFANDHAUS"
- escola: "PRINCIPAL" → "DIRETORIA"
- delegacia: "INTERROGATION" → "VERNHAMMUNG"
- bar: "BAR VILA NOVA" → "GASTHOF"
"""

import requests
import base64
import json
import time
import sys
import socket
import os
from pathlib import Path

socket.setdefaultsource = lambda: socket.AF_INET

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "google/gemini-3-pro-image-preview"
API_URL = "https://openrouter.ai/api/v1/chat/completions"
OUTPUT_DIR = Path("src/assets/images/noir")
MAP_DIR = Path("src/assets/images/noir/maps")
ROOT_IMG = OUTPUT_DIR / "bg_escritorio.png"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

STYLE_PREFIX = """You are generating background art for a noir detective video game called "Murphy Law — Investigações Privadas".
The style must be: dark, moody, film noir aesthetic, high contrast shadows, warm amber/yellow tones against deep blacks,
rain-slicked surfaces reflecting neon, painterly but semi-realistic, 1940s-1950s atmosphere.
The setting is a fictional country mixing Germany, USA, and failed Soviet state — everything is rundown, state companies are bankrupt, nothing works.
IMPORTANT: The image must be a first-person perspective scene as if standing in the room looking forward.
No people visible. Cinematic composition. Aspect ratio 16:9 landscape.
CRITICAL: Any text/signs in the image MUST use German or Portuguese words — NEVER English. This is a German-influenced setting."""

ROOMS = {
    "rua_chuva": {
        "prompt": f"""{STYLE_PREFIX}

Generate a first-person view of a rain-soaked street at night, as if stepping out of a doorway.
Wet asphalt reflecting red and blue neon signs. On the LEFT building: a pharmacy with a neon sign reading "FARMÁCIA" in green.
On the RIGHT building: a vertical neon sign reading "GASTHOF" in flickering red/blue — this is a dive bar/guesthouse.
Further right: a yellow illuminated sign reading "PFANDHAUS" (pawnshop in German) above a dark storefront.
Rain is falling heavily. A flickering streetlamp casts a cone of yellow light. Puddles everywhere.
Fire escape zigzagging up a brick wall on the left. A newspaper blowing in the wind. Distant silhouette of buildings.
No people visible. Deep noir atmosphere — chiaroscuro lighting, wet surfaces, urban decay. Soviet-era decay everywhere."""
    },
    "bar": {
        "prompt": f"""{STYLE_PREFIX}

Generate a first-person view of the interior of a smoky dive bar/guesthouse called "Gasthof" at night.
A long wooden bar counter on the left with bottles on shelves, a neon sign behind the bar reading "GASTHOF" glowing amber.
A few bar stools. A booth in the far right corner with a dim overhead lamp.
Cigarette smoke haze visible in the light beams. A vintage jukebox against the wall.
Wood paneling, worn leather seats. The bar counter has an ashtray and a half-drunk glass.
Warm amber and red lighting. Deep shadows in the corners. No people. Noir atmosphere.
On the wall near the door, a small red neon sign reading "OFFEN" (German for OPEN)."""
    },
    "escola": {
        "prompt": f"""{STYLE_PREFIX}

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
        "prompt": f"""{STYLE_PREFIX}

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


def generate_image(prompt, reference_image_b64=None, aspect_ratio="16:9"):
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
        "model": MODEL,
        "messages": messages,
        "modalities": ["image", "text"],
        "image_config": {
            "aspect_ratio": aspect_ratio,
            "image_size": "2K",
        },
    }

    print(f"  Sending request to {MODEL}...", flush=True)

    for attempt in range(3):
        try:
            resp = requests.post(API_URL, headers=HEADERS, json=payload, timeout=180)
            resp.raise_for_status()
            result = resp.json()

            if "choices" in result and len(result["choices"]) > 0:
                msg = result["choices"][0]["message"]
                if "images" in msg and len(msg["images"]) > 0:
                    img_data = msg["images"][0]["image_url"]["url"]
                    if img_data.startswith("data:image/png;base64,"):
                        return img_data.replace("data:image/png;base64,", "")
                    elif img_data.startswith("data:image/jpeg;base64,"):
                        return img_data.replace("data:image/jpeg;base64,", "")
                    elif img_data.startswith("data:image/webp;base64,"):
                        return img_data.replace("data:image/webp;base64,", "")
                    else:
                        return img_data.split(",", 1)[1] if "," in img_data else None

            print(f"  No image in response.")
            if "error" in result:
                print(f"  API Error: {result['error']}")

        except requests.exceptions.HTTPError as e:
            print(f"  HTTP Error (attempt {attempt+1}): {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"  Response: {e.response.text[:500]}")
        except Exception as e:
            print(f"  Error (attempt {attempt+1}): {e}")

        if attempt < 2:
            wait = 15 * (attempt + 1)
            print(f"  Retrying in {wait}s...")
            time.sleep(wait)

    return None


def generate_map_thumbnail(room_b64, room_name, aspect_ratio="4:3"):
    prompt = f"""{STYLE_PREFIX}

Using this room image as reference, generate a small top-down mini-map view of this location ({room_name}).
It should look like a stylized floor plan or bird's-eye schematic view. Simple, clean lines.
Dark background with subtle green/amber outlines showing the room layout.
Like a security camera or thermal imaging view. Minimalist. No people.
Keep the noir aesthetic but make it look like a map/diagram."""
    return generate_image(prompt, reference_image_b64=room_b64, aspect_ratio=aspect_ratio)


def save_image(b64_data, filepath):
    try:
        img_bytes = base64.b64decode(b64_data)
        backup = filepath.with_suffix(".png.bak")
        if filepath.exists():
            filepath.rename(backup)
            print(f"  Backed up: {backup}")
        filepath.write_bytes(img_bytes)
        size_kb = len(img_bytes) / 1024
        print(f"  Saved: {filepath} ({size_kb:.0f} KB)")
        return True
    except Exception as e:
        print(f"  Failed to save {filepath}: {e}")
        return False


def main():
    if not ROOT_IMG.exists():
        print("FATAL: Root image bg_escritorio.png not found. Cannot use as reference.")
        sys.exit(1)

    root_b64 = base64.b64encode(ROOT_IMG.read_bytes()).decode("utf-8")
    print(f"Loaded root image: {ROOT_IMG} ({ROOT_IMG.stat().st_size / 1024:.0f} KB)")

    generated = []

    for room, config in ROOMS.items():
        print(f"\n{'='*60}")
        print(f"[{room}] Regenerating with corrected signs...")
        print(f"{'='*60}")

        img_b64 = generate_image(config["prompt"], reference_image_b64=root_b64)

        if not img_b64:
            print(f"  Trying without reference image...")
            img_b64 = generate_image(config["prompt"])

        if img_b64:
            filepath = OUTPUT_DIR / f"bg_{room}.png"
            if save_image(img_b64, filepath):
                generated.append(room)

                print(f"  Generating map thumbnail...")
                map_b64 = generate_map_thumbnail(img_b64, room)
                if map_b64:
                    map_path = MAP_DIR / f"map_{room}.png"
                    save_image(map_b64, map_path)
                else:
                    print(f"  WARNING: Could not generate map for {room}")
            else:
                print(f"  FAILED to save {room}")
        else:
            print(f"  FAILED to generate {room}")

        time.sleep(3)

    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Regenerated: {len(generated)}/4 rooms")
    for r in generated:
        print(f"  ✓ {r}")
    missing = set(ROOMS.keys()) - set(generated)
    if missing:
        print(f"  ⚠ Missing: {missing}")
        print("  Re-run to retry.")


if __name__ == "__main__":
    main()
