#!/usr/bin/env python3
"""
Gerador de imagens noir para o jogo Murphy Law.
1. Gera imagem raiz (escritorio) via text-to-image
2. Usa a imagem raiz como referência para editar/gerar as demais salas
3. Gera miniaturas de mapa a partir das imagens de sala

Modelo: google/gemini-2.0-flash-exp (image generation via OpenRouter)
"""

import requests
import base64
import json
import time
import sys
import os
from pathlib import Path

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "google/gemini-3-pro-image-preview"
API_URL = "https://openrouter.ai/api/v1/chat/completions"
OUTPUT_DIR = Path("src/assets/images/noir")
MAP_DIR = Path("src/assets/images/noir/maps")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MAP_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

STYLE_PREFIX = """You are generating background art for a noir detective video game called "Murphy Law — Investigações Privadas".
The style must be: dark, moody, film noir aesthetic, high contrast shadows, warm amber/yellow tones against deep blacks, 
rain-slicked surfaces reflecting neon, painterly but semi-realistic, 1940s-1950s atmosphere. 
IMPORTANT: The image must be a first-person perspective scene as if standing in the room looking forward. 
No text or UI elements in the image. No people visible. Cinematic composition. 
Aspect ratio 16:9 landscape."""

ROOMS = {
    "escritorio": {
        "prompt": f"""{STYLE_PREFIX}

Generate a first-person view of a rundown private detective's office at night. Rain streaks down the single window on the left wall. 
A battered wooden desk dominates the center with piles of case files, a half-empty whiskey bottle, and a tarnished brass lamp casting a warm amber pool of light. 
The desk chair is pushed back. On the right wall, a filing cabinet with a drawer slightly open. 
The ceiling has a water stain and a bare bulb. Cigarette butts in an ashtray. 
The door is visible at the far end with a frosted glass panel reading "MURPHY LAW" (the A is missing). 
Deep shadows in corners. Film noir atmosphere. Warm amber from the lamp, cold blue from the window rain.""",
        "first": True,
    },
    "rua_chuva": {
        "prompt": f"""{STYLE_PREFIX}

Edit this image: Transform the scene into a rain-soaked street at night, as if stepping out of the detective's office doorway.
The office door is behind the viewer. Wet asphalt reflecting red and blue neon signs — a pharmacy, a bar called "Vila Nova", a pawn shop.
Rain is falling heavily. A flickering streetlamp casts a cone of yellow light. Puddles everywhere.
Fire escape zigzagging up a brick wall on the left. A newspaper blowing in the wind. Distant silhouette of buildings.
No people visible. Deep noir atmosphere — chiaroscuro lighting, wet surfaces, urban decay.""",
    },
    "bar": {
        "prompt": f"""{STYLE_PREFIX}

Edit this image: Transform the scene into the interior of a smoky dive bar called "Bar Vila Nova" at night.
A long wooden bar counter on the left with bottles on shelves, a neon sign behind the bar glowing amber.
A few bar stools. A booth in the far right corner with a dim overhead lamp. 
Cigarette smoke haze visible in the light beams. A vintage jukebox against the wall.
Wood paneling, worn leather seats. The bar counter has an ashtray and a half-drunk glass.
Warm amber and red lighting. Deep shadows in the corners. No people. Noir atmosphere.""",
    },
    "escola": {
        "prompt": f"""{STYLE_PREFIX}

Edit this image: Transform the scene into an empty school hallway at night.
Fluorescent lights flicker overhead, casting a sickly green-white glow on scuffed linoleum floors.
Lockers line both walls — some dented, one slightly open. Bulletin board with faded notices.
A water fountain on the right wall. Classroom doors along the corridor, one has a broken window.
At the far end, the principal's office door with a brass nameplate. Shadows are deep and unsettling.
The atmosphere is institutional, cold, and eerie. A single red "EXIT" sign glows at the end.
No people. Noir horror-detective atmosphere.""",
    },
    "diretoria": {
        "prompt": f"""{STYLE_PREFIX}

Edit this image: Transform the scene into a school principal's office at night.
A heavy wooden desk with a leather chair behind it. Bookshelves with law manuals and education codes.
Framed certificates on the wall — one is crooked. A filing cabinet with a lock.
A window with blinds partially open, letting in moonlight. A small plant on the windowsill, wilting.
On the desk: a phone, scattered papers, a nameplate reading "Diretora Elvira Costa".
A side table with a coffee mug and an ashtray. The room smells of old paper and secrets.
Warm amber desk lamp, cold moonlight from window. Deep shadows. No people. Noir atmosphere.""",
    },
    "delegacia": {
        "prompt": f"""{STYLE_PREFIX}

Edit this image: Transform the scene into a run-down police precinct interior at night.
A front desk/bulletproof glass window on the left. Rows of wooden benches in the waiting area.
Filing cabinets against the wall — one drawer hanging open. A water cooler.
On the wall: a bulletin board with suspect photos and case numbers, some circled in red.
Fluorescent lighting, one bulb flickering. A hallway leading to interrogation rooms in the back.
A "MISSING PERSONS" poster board with several faces — one photo is highlighted.
Institutional green walls, scuffed floor. No people. Oppressive, corrupt atmosphere. Noir.""",
    },
    "beco": {
        "prompt": f"""{STYLE_PREFIX}

Edit this image: Transform the scene into a dark alleyway at night, rain pouring.
Brick walls on both sides, fire escape ladders zigzagging up. A dumpster overflowing.
A single flickering bulb above a back door. Rain creates rivers along the cracked pavement.
Graffiti on the wall — a faded message. Puddles reflecting the dim light.
At the far end, a figure-sized shadow (not a person, just a shadow cast on the wall).
A stray cat sitting on a fire escape. Steam rising from a grate.
Oppressive darkness, claustrophobic. Chiaroscuro. Noir atmosphere. No people visible.""",
    },
    "armazem": {
        "prompt": f"""{STYLE_PREFIX}

Edit this image: Transform the scene into the interior of an abandoned warehouse at night.
Vast space with high ceilings, exposed metal beams and rusted supports. 
Wooden crates stacked along the walls. A forklift parked in the corner, covered in dust.
A single bare bulb hanging from a chain, swinging slightly. Large industrial doors at the far end, one slightly ajar with moonlight bleeding through.
On the floor: scattered papers, a broken chair, drag marks in the dust.
A metal stairway leading to a catwalk overhead. Cobwebs in the corners.
Ominous, cavernous atmosphere. Industrial noir. Deep shadows. No people.""",
    },
}


def generate_image(prompt: str, reference_image_b64: str | None = None, aspect_ratio: str = "16:9") -> str | None:
    """Generate an image via OpenRouter. Returns base64 PNG data or None on failure."""

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
            resp = requests.post(API_URL, headers=HEADERS, json=payload, timeout=120)
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
                        print(f"  Unknown image format: {img_data[:60]}...")
                        return img_data.split(",", 1)[1] if "," in img_data else None

            print(f"  No image in response. Full response keys: {list(result.keys())}")
            if "error" in result:
                print(f"  API Error: {result['error']}")
            elif "choices" in result:
                msg = result["choices"][0]["message"]
                print(f"  Message keys: {list(msg.keys())}")
                if "content" in msg:
                    print(f"  Text content: {msg['content'][:200]}...")

        except requests.exceptions.HTTPError as e:
            print(f"  HTTP Error (attempt {attempt+1}): {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"  Response body: {e.response.text[:500]}")
        except Exception as e:
            print(f"  Error (attempt {attempt+1}): {e}")

        if attempt < 2:
            wait = 10 * (attempt + 1)
            print(f"  Retrying in {wait}s...")
            time.sleep(wait)

    return None


def generate_map_thumbnail(room_b64: str, room_name: str, aspect_ratio: str = "4:3") -> str | None:
    """Generate a smaller top-down map thumbnail from a room image."""
    prompt = f"""{STYLE_PREFIX}

Using this room image as reference, generate a small top-down mini-map view of this location ({room_name}).
It should look like a stylized floor plan or bird's-eye schematic view. Simple, clean lines.
Dark background with subtle green/amber outlines showing the room layout.
Like a security camera or thermal imaging view. Minimalist. No people.
Keep the noir aesthetic but make it look like a map/diagram."""

    return generate_image(prompt, reference_image_b64=room_b64, aspect_ratio=aspect_ratio)


def save_image(b64_data: str, filepath: Path) -> bool:
    """Save base64 image data to a file."""
    try:
        img_bytes = base64.b64decode(b64_data)
        filepath.write_bytes(img_bytes)
        size_kb = len(img_bytes) / 1024
        print(f"  Saved: {filepath} ({size_kb:.0f} KB)")
        return True
    except Exception as e:
        print(f"  Failed to save {filepath}: {e}")
        return False


def main():
    room_order = [
        "escritorio",
        "rua_chuva",
        "bar",
        "escola",
        "diretoria",
        "delegacia",
        "beco",
        "armazem",
    ]

    root_b64 = None
    generated = {}

    # Phase 1: Generate root image (escritorio)
    print("=" * 60)
    print("PHASE 1: Generating root image (escritorio)")
    print("=" * 60)

    room = room_order[0]
    config = ROOMS[room]
    print(f"\n[{room}] Generating from text prompt...")
    img_b64 = generate_image(config["prompt"])

    if img_b64:
        filepath = OUTPUT_DIR / f"bg_{room}.png"
        if save_image(img_b64, filepath):
            root_b64 = img_b64
            generated[room] = filepath
            print(f"  ROOT IMAGE READY ✓")
        else:
            print("  FATAL: Could not save root image. Aborting.")
            sys.exit(1)
    else:
        print("  FATAL: Could not generate root image. Aborting.")
        sys.exit(1)

    # Phase 2: Generate all other rooms using root as reference
    print("\n" + "=" * 60)
    print("PHASE 2: Generating other rooms (editing from root)")
    print("=" * 60)

    for room in room_order[1:]:
        config = ROOMS[room]
        print(f"\n[{room}] Generating with root reference...")
        img_b64 = generate_image(config["prompt"], reference_image_b64=root_b64)

        if img_b64:
            filepath = OUTPUT_DIR / f"bg_{room}.png"
            if save_image(img_b64, filepath):
                generated[room] = filepath
            else:
                print(f"  WARNING: Failed to save {room}, will try without reference...")
                img_b64_fallback = generate_image(config["prompt"])
                if img_b64_fallback:
                    filepath = OUTPUT_DIR / f"bg_{room}.png"
                    if save_image(img_b64_fallback, filepath):
                        generated[room] = filepath
        else:
            print(f"  WARNING: Failed with reference, trying without...")
            img_b64_fallback = generate_image(config["prompt"])
            if img_b64_fallback:
                filepath = OUTPUT_DIR / f"bg_{room}.png"
                if save_image(img_b64_fallback, filepath):
                    generated[room] = filepath

        time.sleep(2)  # Rate limit courtesy

    # Phase 3: Generate map thumbnails
    print("\n" + "=" * 60)
    print("PHASE 3: Generating map thumbnails")
    print("=" * 60)

    for room, room_config in ROOMS.items():
        if room not in generated:
            print(f"\n[{room}] SKIPPED — no bg image available")
            continue

        print(f"\n[{room}] Generating map thumbnail...")
        room_name = room_config["prompt"].split("Transform the scene into")[-1].split(".")[0].strip() if "Transform" in room_config["prompt"] else "Escritório de Murphy Law"
        
        # Read the room bg image
        bg_path = generated[room]
        room_b64 = base64.b64encode(bg_path.read_bytes()).decode("utf-8")

        map_b64 = generate_map_thumbnail(room_b64, room_name, aspect_ratio="4:3")

        if map_b64:
            map_path = MAP_DIR / f"map_{room}.png"
            if save_image(map_b64, map_path):
                print(f"  Map thumbnail saved ✓")
        else:
            print(f"  WARNING: Could not generate map for {room}")

        time.sleep(2)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"\nRoom backgrounds generated: {len(generated)}/8")
    for room, path in generated.items():
        print(f"  ✓ {room}: {path}")

    map_count = len(list(MAP_DIR.glob("map_*.png")))
    print(f"\nMap thumbnails generated: {map_count}/8")

    if len(generated) < 8:
        print(f"\n⚠ Missing rooms: {set(room_order) - set(generated.keys())}")
        print("  Re-run the script to retry failed rooms.")
    else:
        print("\n✓ All room images generated successfully!")


if __name__ == "__main__":
    main()
