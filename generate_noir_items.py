#!/usr/bin/env python3
"""
Gerador de imagens de itens coletáveis noir para o jogo Murphy Law.
Gera 6 imagens de itens via OpenRouter (text-to-image).

Modelo: google/gemini-3-pro-image-preview
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
OUTPUT_DIR = Path("src/assets/images/noir/items")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

ITEMS = {
    "chave_escritorio": {
        "prompt": """Generate a single item icon for a noir detective video game.
A rusty old brass key, tarnished with age, lying on a dark wooden surface.
Film noir aesthetic — high contrast, deep shadows, warm amber highlight on the key.
The key is ornate, old-fashioned, with a diamond-shaped bow.
Dark background, cinematic lighting, isolated object, no text, no people.
Square composition, item icon style, dark moody atmosphere.""",
        "filename": "item_chave_escritorio.png",
    },
    "cartao_visita": {
        "prompt": """Generate a single item icon for a noir detective video game.
A soaked business card on wet dark asphalt, raindrops on its surface.
The card reads "Diretora Elvira Campos" visible in elegant faded gold lettering.
Film noir aesthetic — high contrast, warm amber streetlight reflection on the wet card.
Dark background, cinematic lighting, isolated object, no text other than the card itself, no people.
Square composition, item icon style, dark moody atmosphere.""",
        "filename": "item_cartao_visita.png",
    },
    "fotografia": {
        "prompt": """Generate a single item icon for a noir detective video game.
A crumpled, whiskey-stained photograph of a smiling 9-year-old girl in front of a school.
The photo is creased and worn, with amber liquid stains on the edges.
Film noir aesthetic — high contrast, warm amber light, deep shadows.
The photo is lying on a dark surface. Dark background, cinematic lighting, isolated object, no text, no people visible except the photo subject.
Square composition, item icon style, dark moody atmosphere.""",
        "filename": "item_fotografia.png",
    },
    "isqueiro": {
        "prompt": """Generate a single item icon for a noir detective video game.
A silver antique lighter with the initials "M.L." engraved on its surface.
The lighter is closed, ornate silver with patina and scratches from years of use.
A small flame reflection glints off the metal surface.
Film noir aesthetic — high contrast, warm amber light on the silver, deep shadows.
Dark background, cinematic lighting, isolated object, no text, no people.
Square composition, item icon style, dark moody atmosphere.""",
        "filename": "item_isqueiro.png",
    },
"fita_magnetica": {
    "prompt": """Generate a single item icon for a noir detective video game.
A vintage reel-to-reel magnetic tape, the kind used in 1970s Eastern Bloc computer systems. The tape is partially unwound, sitting on a dark metal surface. The reel has Cyrillic-style industrial markings and a handwritten label "WOHLTAT-PROGRAMM" in faded red ink. The tape surface has a slight green phosphor glow reflecting off it, as if it was just removed from a computer terminal. Film noir aesthetic — high contrast, warm amber desk lamp mixed with cold green phosphor reflection, deep shadows. Soviet-era industrial design. Dark background, cinematic lighting, isolated object, no people. Square composition, item icon style, dark moody atmosphere.""",
    "filename": "item_fita_magnetica.png",
  },
    "cedula_500": {
        "prompt": """Generate a single item icon for a noir detective video game.
A crumpled 500 Marks banknote from a fictional Eastern European country, worn and used, lying on a dark surface. The bill is slightly unfolded showing the denomination. Edges are frayed and dirty. The design features stern classical architecture and official seals in faded ink. Film noir aesthetic — high contrast, warm amber light, deep shadows. The muted green/brown tones of the banknote contrast with the dark amber surroundings. Dark background, cinematic lighting, isolated object, no text besides the bill, no people. Square composition, item icon style, dark moody atmosphere.""",
        "filename": "item_cedula_500.png",
    },
}


def generate_image(prompt: str, aspect_ratio: str = "1:1") -> str | None:
    messages = [{"role": "user", "content": prompt}]

    payload = {
        "model": MODEL,
        "messages": messages,
        "modalities": ["image", "text"],
        "image_config": {
            "aspect_ratio": aspect_ratio,
            "image_size": "1K",
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
                    if "base64," in img_data:
                        return img_data.split("base64,", 1)[1]
                    return img_data

            print(f"  No image in response.")
            if "error" in result:
                print(f"  API Error: {result['error']}")
            elif "choices" in result:
                msg = result["choices"][0]["message"]
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


def save_image(b64_data: str, filepath: Path) -> bool:
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
    generated = {}

    for item_id, config in ITEMS.items():
        print(f"\n[{item_id}] Generating item image...")
        img_b64 = generate_image(config["prompt"])

        if img_b64:
            filepath = OUTPUT_DIR / config["filename"]
            if save_image(img_b64, filepath):
                generated[item_id] = filepath
        else:
            print(f"  FAILED: Could not generate {item_id}")

        time.sleep(3)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"\nItem images generated: {len(generated)}/6")
    for item_id, path in generated.items():
        print(f"  ✓ {item_id}: {path}")

    if len(generated) < 6:
        print(f"\n⚠ Missing items: {set(ITEMS.keys()) - set(generated.keys())}")
    else:
        print("\n✓ All item images generated successfully!")


if __name__ == "__main__":
    main()
