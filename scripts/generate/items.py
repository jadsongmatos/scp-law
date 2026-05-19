#!/usr/bin/env python3
"""
Gerador de imagens de itens coletáveis noir para o jogo Murphy Law.
Gera 6 imagens de itens via OpenRouter (text-to-image).

Modelo: google/gemini-3-pro-image-preview
"""

import time

from scripts.shared.config import (
    NOIR_ITEMS_DIR,
    ITEM_STYLE_PREFIX,
)
from scripts.shared.openrouter import generate_image, save_image
from scripts.shared.ipv4_fix import force_ipv4

ITEMS = {
    "chave_escritorio": {
        "prompt": f"""{ITEM_STYLE_PREFIX}
A rusty old brass key, tarnished with age, lying on a dark wooden surface.
The key is ornate, old-fashioned, with a diamond-shaped bow.""",
        "filename": "item_chave_escritorio.png",
    },
    "cartao_visita": {
        "prompt": f"""{ITEM_STYLE_PREFIX}
A soaked business card on wet dark asphalt, raindrops on its surface.
The card reads "Diretora Elvira Campos" visible in elegant faded gold lettering.""",
        "filename": "item_cartao_visita.png",
    },
    "fotografia": {
        "prompt": f"""{ITEM_STYLE_PREFIX}
A crumpled, whiskey-stained photograph of a smiling 9-year-old girl in front of a school.
The photo is creased and worn, with amber liquid stains on the edges.
The photo is lying on a dark surface.""",
        "filename": "item_fotografia.png",
    },
    "isqueiro": {
        "prompt": f"""{ITEM_STYLE_PREFIX}
A silver antique lighter with the initials "M.L." engraved on its surface.
The lighter is closed, ornate silver with patina and scratches from years of use.
A small flame reflection glints off the metal surface.""",
        "filename": "item_isqueiro.png",
    },
    "fita_magnetica": {
        "prompt": f"""{ITEM_STYLE_PREFIX}
A vintage reel-to-reel magnetic tape, the kind used in 1970s Eastern Bloc computer systems. The tape is partially unwound, sitting on a dark metal surface. The reel has Cyrillic-style industrial markings and a handwritten label "WOHLTAT-PROGRAMM" in faded red ink. The tape surface has a slight green phosphor glow reflecting off it, as if it was just removed from a computer terminal. Film noir aesthetic — high contrast, warm amber desk lamp mixed with cold green phosphor reflection, deep shadows. Soviet-era industrial design.""",
        "filename": "item_fita_magnetica.png",
    },
    "cedula_500": {
        "prompt": f"""{ITEM_STYLE_PREFIX}
A crumpled 500 Marks banknote from a fictional Eastern European country, worn and used, lying on a dark surface. The bill is slightly unfolded showing the denomination. Edges are frayed and dirty. The design features stern classical architecture and official seals in faded ink. The muted green/brown tones of the banknote contrast with the dark amber surroundings.""",
        "filename": "item_cedula_500.png",
    },
}


def main():
    force_ipv4()

    NOIR_ITEMS_DIR.mkdir(parents=True, exist_ok=True)

    generated = {}

    for item_id, config in ITEMS.items():
        print(f"\n[{item_id}] Generating item image...")
        img_b64 = generate_image(config["prompt"], aspect_ratio="1:1", image_size="1K")

        if img_b64:
            filepath = NOIR_ITEMS_DIR / config["filename"]
            if save_image(img_b64, filepath):
                generated[item_id] = filepath
        else:
            print(f" FAILED: Could not generate {item_id}")

        time.sleep(3)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"\nItem images generated: {len(generated)}/6")
    for item_id, path in generated.items():
        print(f" ✓ {item_id}: {path}")

    if len(generated) < 6:
        print(f"\n⚠ Missing items: {set(ITEMS.keys()) - set(generated.keys())}")
    else:
        print("\n✓ All item images generated successfully!")


if __name__ == "__main__":
    main()
