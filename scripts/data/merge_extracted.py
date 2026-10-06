#!/usr/bin/env python3
"""
merge_extracted.py
Mescla o resultado do pipeline DINOv2+Gemma (extracted_positions.json)
no game_data.json do jogo, normalizando campos para o formato esperado.

Uso:
python3 -m scripts.data.merge_extracted
"""

import json
from copy import deepcopy

from scripts.shared.config import GAME_DATA_PATH

EXTRACTED_PATH = GAME_DATA_PATH.parent.parent / "extracted_positions.json"

NOIR_ROOMS = {
    "rua_chuva": "rua_chuva",
    "escritorio": "escritorio",
    "escola": "escola",
    "diretoria": "diretoria",
    "delegacia": "delegacia",
    "beco": "beco",
    "bar": "bar",
    "armazem": "armazem",
    "igreja": "igreja",
    "fazenda": "fazenda",
    "hospital": "hospital",
    "casa_mae": "casa_mae",
}


def normalize_target_room(room_id: str) -> str | None:
    return NOIR_ROOMS.get(room_id, room_id if room_id in NOIR_ROOMS.values() else None)


def normalize_document_data(doc) -> dict | None:
    if doc is None:
        return None
    if isinstance(doc, dict):
        return doc
    if isinstance(doc, str):
        paragraphs = [p.strip() for p in doc.split(".") if p.strip()]
        content = []
        for p in paragraphs:
            sentence = p.strip()
            if sentence and not sentence.endswith("."):
                sentence += "."
            content.append(sentence)
        if not content:
            content = [doc]
        return {"title": "ARQUIVO RECUPERADO", "content": content}
    return None


def normalize_interactable(item: dict, room_id: str) -> dict | None:
    result = {
        "id": item.get("id", f"item_{room_id}_{hash(str(item)) % 10000}"),
        "x": round(item.get("x", 50), 1),
        "y": round(item.get("y", 50), 1),
        "icon": item.get("icon", "Search"),
        "type": item.get("type", "inspect"),
        "label": item.get("label", "Objeto"),
    }

    if item.get("width"):
        result["width"] = round(item["width"], 1)
    if item.get("height"):
        result["height"] = round(item["height"], 1)
    if item.get("hideIcon"):
        result["hideIcon"] = item["hideIcon"]
    if item.get("description"):
        result["description"] = item["description"]

    if item["type"] == "travel":
        target = normalize_target_room(item.get("targetRoom"))
        if target:
            result["targetRoom"] = target
        else:
            return None

    if item["type"] == "pickup":
        pickup = item.get("pickupItem")
        if pickup:
            result["pickupItem"] = pickup
            result["hideAfterInteract"] = True
            if not result.get("description"):
                result["description"] = f"Você pegou: {pickup}"

    required = item.get("requiredItem")
    if required:
        result["requiredItem"] = required
        if not result.get("failedMessage"):
            result["failedMessage"] = "Não funciona."

    if item.get("successMessage"):
        result["successMessage"] = item["successMessage"]

    doc = normalize_document_data(item.get("documentData"))
    if doc:
        result["documentData"] = doc

    if item.get("hideAfterInteract"):
        result["hideAfterInteract"] = True

    return result


def merge_room(room_id: str, extracted: dict, original: dict) -> dict:
    merged = deepcopy(original)
    merged.setdefault("interactables", [])

    for item in extracted.get("interactables", []):
        norm = normalize_interactable(item, room_id)
        if norm is None:
            continue
        existing_ids = {obj["id"] for obj in merged["interactables"]}
        if norm["id"] not in existing_ids:
            merged["interactables"].append(norm)

    return merged


def main():
    with open(GAME_DATA_PATH, "r", encoding="utf-8") as f:
        game_data = json.load(f)

    if not EXTRACTED_PATH.exists():
        print(f"ERRO: {EXTRACTED_PATH} não encontrado.", file=__import__("sys").stderr)
        __import__("sys").exit(1)

    with open(EXTRACTED_PATH, "r", encoding="utf-8") as f:
        extracted = json.load(f)

    for room_id, ext_room in extracted["rooms"].items():
        # Skip rooms the vision pipeline could not identify (guess_room_id
        # fallback produces 'unknown_room'): they must not create rooms in
        # game_data.json, only merge into rooms that already exist.
        if normalize_target_room(room_id) is None and room_id not in game_data["GAME_ROOMS"]:
            print(f"  [skip] sala não mapeada em NOIR_ROOMS: {room_id}")
            continue
        if room_id in game_data["GAME_ROOMS"]:
            game_data["GAME_ROOMS"][room_id] = merge_room(
                room_id, ext_room, game_data["GAME_ROOMS"][room_id]
            )
        else:
            merged = merge_room(
                room_id, ext_room,
                {"id": room_id, "name": ext_room.get("name", room_id), "description": "", "interactables": []},
            )
            game_data["GAME_ROOMS"][room_id] = merged

    with open(GAME_DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(game_data, f, ensure_ascii=False, indent=2)

    total = sum(len(r.get("interactables", [])) for r in game_data["GAME_ROOMS"].values())
    print(f"game_data.json atualizado!")
    print(f"Salas: {list(game_data['GAME_ROOMS'].keys())}")
    print(f"Total interactivables: {total}")

    for room_id, room in game_data["GAME_ROOMS"].items():
        items = room.get("interactables", [])
        types = {}
        for i in items:
            t = i.get("type", "unknown")
            types[t] = types.get(t, 0) + 1
        print(f" {room_id}: {len(items)} itens {types}")


if __name__ == "__main__":
    main()
