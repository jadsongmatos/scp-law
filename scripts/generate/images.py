#!/usr/bin/env python3
"""
Gerador de imagens noir para o jogo Murphy Law via 9Router (localhost:20128).
Le GAME_ROOMS e ITEM_NAMES do game_data.json.
Gera fundos (bg_*.png), miniaturas de mapa (map_*.png) e icones (item_*.png).
"""
import argparse
import base64
import hashlib
import json
import sys
import time
from pathlib import Path

from scripts.shared.ninerouter import generate_image, save_image

DATA_PATH = Path("src/game_data.json")
NOIR_DIR = Path("src/assets/images/noir")
MAP_DIR = NOIR_DIR / "maps"
ITEMS_DIR = NOIR_DIR / "items"
NOIR_DIR.mkdir(parents=True, exist_ok=True)
MAP_DIR.mkdir(parents=True, exist_ok=True)
ITEMS_DIR.mkdir(parents=True, exist_ok=True)

NOIR_STYLE = (
    "Film noir aesthetic, dark, moody, high contrast shadows, "
    "warm amber/yellow tones against deep blacks, "
    "rain-slicked surfaces, painterly semi-realistic, "
    "first-person perspective, no people visible, "
    "cinematic 16:9 composition. "
    "Setting: fictional country mixing Germany, USA, and failed Soviet state. "
    "Text/signs in German or Portuguese, NEVER English."
)

ITEM_STYLE = (
    "Single item icon for a noir detective game. "
    "Film noir aesthetic, high contrast, deep shadows, warm amber highlight. "
    "Dark background, cinematic lighting, isolated object, no text, no people. "
    "Square composition, dark moody atmosphere."
)

ROOM_PROMPTS = {
    "escritorio": (
        "Rundown private detective's office at night. Rain on window. "
        "Battered wooden desk with case files, whiskey bottle, brass lamp. "
        "Filing cabinet. Water stain on ceiling. "
        "Door with 'MURPHY LAW' frosted glass (missing A). Deep shadows."
    ),
    "rua_chuva": (
        "Rain-soaked street at night. Wet asphalt reflecting neon signs. "
        "Flickering streetlamp. Fire escape on brick wall. "
        "Pharmacy sign, bar 'Vila Nova', pawn shop. Puddles everywhere."
    ),
    "bar": (
        "Smoky dive bar 'Vila Nova' interior. Long wooden counter, "
        "neon sign, booth with dim lamp, cigarette smoke, jukebox. "
        "Warm amber/red lighting. Deep shadows."
    ),
    "escola": (
        "Empty school hallway at night. Flickering fluorescent lights. "
        "Lockers, bulletin board, water fountain. "
        "Classroom doors, one broken window. Red EXIT sign. Eerie atmosphere."
    ),
    "diretoria": (
        "School principal's office. Heavy desk, leather chair, bookshelves. "
        "Framed certificates, one crooked. Filing cabinet with lock. "
        "Window with blinds. Wilting plant. "
        "Nameplate 'Diretora Elvira Costa'. Warm lamp, cold moonlight."
    ),
    "delegacia": (
        "Run-down police precinct. Bulletproof glass window, wooden benches, "
        "filing cabinets, one drawer open. Water cooler. "
        "Bulletin board with suspect photos. "
        "'MISSING PERSONS' poster board. Flickering fluorescent light."
    ),
    "beco": (
        "Dark alley at night, heavy rain. Brick walls, fire escapes, "
        "overflowing dumpster. Flickering bulb. Graffiti. "
        "Figure-sized shadow cast on wall. Stray cat on fire escape. "
        "Steam rising from grate. Claustrophobic."
    ),
    "armazem": (
        "Abandoned warehouse interior. High ceiling, metal beams, "
        "wooden crates, dusty forklift. Single bare bulb swinging. "
        "Industrial door ajar with moonlight. Scattered papers. "
        "Metal stairway to catwalk. Cobwebs. Ominous."
    ),
    "igreja": (
        "Old stone church interior at night. Flickering candlelight, "
        "wooden pews, stained glass window with faint moonlight. "
        "Altar with worn cloth. Confessional booth. "
        "High vaulted ceiling with shadows. Incense smoke. Silent and solemn."
    ),
    "fazenda": (
        "Rural farmhouse at dusk. Long dirt road leading to wooden barn. "
        "Old tractor. Fenced pasture. Weathered wooden fence. "
        "Gray cloudy sky. Single light on in farmhouse window. "
        "Dry grass. Isolated and quiet."
    ),
    "hospital": (
        "Small district hospital waiting room at night. Empty plastic chairs, "
        "reception window with blinds, fluorescent light flickering. "
        "Linoleum floor. Bulletin board with faded health posters. "
        "Quiet and sterile."
    ),
    "casa_mae": (
        "Modest house living room at night. Family photographs on shelf, "
        "wooden table with handwritten letter, old radio. "
        "Worn armchair. Kitchen doorway visible. "
        "Warm lamp light. Melancholic atmosphere."
    ),
}

ITEM_PROMPTS = {
    "cartao_visita": (
        "Soaked business card on wet asphalt. "
        "'Diretora Elvira Campos' in faded gold lettering."
    ),
    "fotografia": (
        "Crumpled whiskey-stained photograph of smiling 9-year-old girl "
        "in front of school. Amber stains."
    ),
    "isqueiro": (
        "Silver antique lighter with 'M.L.' engraved. "
        "Ornate silver with patina. Flame reflection."
    ),
    "fita_magnetica": (
        "Vintage reel-to-reel magnetic tape, partially unwound. "
        "Cyrillic markings. Label 'WOHLTAT-PROGRAMM'. Green phosphor glow."
    ),
    "cedula_500": (
        "Crumpled 500 Marks banknote, worn and frayed. "
        "Faded ink, stern classical architecture. Green/brown tones."
    ),
    "gravador_cassete": (
        "Vintage cassette recorder, black plastic and silver, worn buttons, "
        "small microphone grille, audio cassette partially inside. "
        "Noir lighting, dark background."
    ),
    "chave_armazem": (
        "Rusty industrial key on dark ground, heavy iron, "
        "large bow with number '7' engraving. Old and worn."
    ),
}


def load_game_data():
    with open(DATA_PATH) as f:
        return json.load(f)


def gen_room_image(prompt: str) -> bytes | None:
    img_b64 = generate_image(prompt, size="1536x1024")
    if img_b64:
        return base64.b64decode(img_b64)
    return None


def gen_item_image(prompt: str) -> bytes | None:
    img_b64 = generate_image(prompt, size="1024x1024")
    if img_b64:
        return base64.b64decode(img_b64)
    return None


def gen_map_image(prompt: str) -> bytes | None:
    img_b64 = generate_image(prompt, size="1024x768")
    if img_b64:
        return base64.b64decode(img_b64)
    return None


def get_room_prompt(room_id: str, room_name: str) -> str:
    if room_id in ROOM_PROMPTS:
        return f"{NOIR_STYLE} {ROOM_PROMPTS[room_id]}"
    return f"{NOIR_STYLE} Scene of {room_name}. Dark, moody, film noir atmosphere."


def get_item_prompt(item_id: str, item_name: str) -> str:
    if item_id in ITEM_PROMPTS:
        return f"{ITEM_STYLE} {ITEM_PROMPTS[item_id]}"
    return f"{ITEM_STYLE} {item_name}. Dark background, isolated, noir lighting."


BG_PLACEHOLDER_MAX_KB = 300  # bg images smaller than this are placeholders
BG_SKIP = {"beco"}  # rooms to skip even if placeholder (manually replaced)


def file_md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def is_placeholder_bg(path: Path) -> bool:
    if not path.exists():
        return True
    return path.stat().st_size < BG_PLACEHOLDER_MAX_KB * 1024


def is_duplicate_map(path: Path, ref_md5: str) -> bool:
    if not path.exists():
        return True
    return file_md5(path) == ref_md5


def is_duplicate_item(path: Path, ref_md5: str) -> bool:
    if not path.exists():
        return True
    return file_md5(path) == ref_md5


def generate_rooms(data, missing_only=False):
    rooms = data.get("GAME_ROOMS", {})
    room_ids = list(rooms.keys())
    if not room_ids:
        print("ERRO: Nenhuma sala encontrada em game_data.json")
        sys.exit(1)

    print("=" * 60)
    print(f"ROOMS: {len(room_ids)} salas encontradas")
    print("=" * 60)

    # Baseline MD5 of a known duplicate map (map_bar.png)
    map_ref_md5 = file_md5(MAP_DIR / "map_bar.png") if (MAP_DIR / "map_bar.png").exists() else ""

    rooms_to_gen = []
    for room_id in room_ids:
        bg_path = NOIR_DIR / f"bg_{room_id}.png"
        if missing_only and bg_path.exists() and not is_placeholder_bg(bg_path):
            continue
        if room_id in BG_SKIP:
            continue
        rooms_to_gen.append(room_id)

    for room_id in rooms_to_gen:
        rname = rooms[room_id].get("name", room_id)
        prompt = get_room_prompt(room_id, rname)

        print(f"[{room_id}] {rname} (text-to-image)...")
        img = gen_room_image(prompt)
        if img:
            (NOIR_DIR / f"bg_{room_id}.png").write_bytes(img)
            print(f" OK")
        else:
            print(f" FALHA")
        time.sleep(3)

    print("\n" + "=" * 60)
    print("ROOMS: Gerando miniaturas de mapa")
    print("=" * 60)

    maps_to_gen = []
    for room_id in room_ids:
        bg_path = NOIR_DIR / f"bg_{room_id}.png"
        map_path = MAP_DIR / f"map_{room_id}.png"
        if not bg_path.exists():
            continue
        if missing_only and map_path.exists() and not is_duplicate_map(map_path, map_ref_md5):
            continue
        if missing_only and room_id == "bar" and map_path.exists():
            continue  # map_bar is the reference; not a real duplicate of itself
        maps_to_gen.append(room_id)

    for room_id in maps_to_gen:
        print(f"[{room_id}] Mapa...")
        map_prompt = (
            f"{NOIR_STYLE} "
            f"Top-down mini-map view of {room_id}. "
            "Stylized floor plan, dark background, green/amber outlines. "
            "Security camera view. Minimalist."
        )
        img = gen_map_image(map_prompt)
        if img:
            (MAP_DIR / f"map_{room_id}.png").write_bytes(img)
            print(f" OK")
        else:
            print(f" FALHA")
        time.sleep(3)


def generate_items(data, missing_only=False):
    items = data.get("ITEM_NAMES", {})
    print("\n" + "=" * 60)
    print(f"ITEMS: {len(items)} itens encontrados")
    print("=" * 60)

    # Baseline MD5 of a known duplicate item (item_cartao_visita.png)
    item_ref_md5 = file_md5(ITEMS_DIR / "item_cartao_visita.png") if (ITEMS_DIR / "item_cartao_visita.png").exists() else ""

    for item_id, item_name in items.items():
        item_path = ITEMS_DIR / f"item_{item_id}.png"
        if missing_only and item_path.exists() and not is_duplicate_item(item_path, item_ref_md5):
            continue
        if missing_only and item_id == "cartao_visita" and item_path.exists():
            continue

        prompt = get_item_prompt(item_id, item_name)
        print(f"[{item_id}] {item_name}...")
        img = gen_item_image(prompt)
        if img:
            (ITEMS_DIR / f"item_{item_id}.png").write_bytes(img)
            print(f" OK")
        else:
            print(f" FALHA")


def main():
    parser = argparse.ArgumentParser(description="Gerador de imagens noir via 9Router")
    parser.add_argument("--missing-only", action="store_true",
                        help="Gerar apenas placeholders/duplicatas (bg <300KB, mapas/itens duplicados)")
    args = parser.parse_args()

    data = load_game_data()
    generate_rooms(data, missing_only=args.missing_only)
    generate_items(data, missing_only=args.missing_only)
    print("\nConcluido!")


if __name__ == "__main__":
    main()