#!/usr/bin/env python3
"""
merge_extracted.py
Mescla o resultado do pipeline YOLO+Gemma (extracted_positions.json)
no game_data.json do jogo, normalizando campos para o formato esperado.

Uso:
  python3 merge_extracted.py
"""

import json
from copy import deepcopy

EXTRACTED = "extracted_positions.json"
GAME_DATA = "src/game_data.json"
OUTPUT = "src/game_data.json"

TARGET_ROOM_MAP = {
    "sector_4_interior": "corridor",
    "corridor": "corridor",
    "entrance": "entrance",
    "scp_173_room": "scp_173_room",
    "scp_049_room": "scp_049_room",
    "scp_096_room": "scp_096_room",
    "scp_682_room": "scp_682_room",
    "server_room": "server_room",
    "containment": "containment",
    "containment_cell_d1": "scp_173_room",
    "security_checkpoint_e2": "server_room",
    "dark_sector_e2": "containment",
    "lab_7b": "scp_049_room",
    "maintenance_shaft": "corridor",
    "containment_chamber_interior": "containment",
}

KEYCARD_MAP = {
    "keycard_level_1": "keycard_1",
    "keycard_level_2": "keycard_2",
    "keycard_level_3": "keycard_3",
    "keycard_level_4": "keycard_3",
    "id_chip_personnel": "keycard_1",
}

ROOM_TRAVEL_REQUIREMENTS = {
    ("entrance", "corridor"): {"requiredItem": "keycard_1", "failedMessage": "[ACESSO NEGADO] Requer Cartão de Acesso Nível 1.", "successMessage": "O leitor apitou verde. Porta destrancada."},
    ("corridor", "scp_173_room"): {"requiredItem": "keycard_2", "failedMessage": "[ACESSO NEGADO] Requer Cartão de Acesso Nível 2.", "successMessage": "Trancas liberadas. Entrando no setor..."},
    ("corridor", "scp_049_room"): {"requiredItem": "keycard_3", "failedMessage": "[ACESSO NEGADO] Requer Cartão de Acesso Nível 3.", "successMessage": "Trancas liberadas. Entrando no setor..."},
    ("corridor", "scp_096_room"): {"requiredItem": "keycard_2", "failedMessage": "[ACESSO NEGADO] Requer Cartão de Acesso Nível 2.", "successMessage": "Trancas liberadas. Entrando no setor..."},
    ("corridor", "scp_682_room"): {},
    ("corridor", "server_room"): {"requiredItem": "keycard_2", "failedMessage": "[ACESSO NEGADO] Requer Cartão de Acesso Nível 2."},
    ("corridor", "containment"): {"requiredItem": "keycard_3", "failedMessage": "[ISOLAMENTO] Requer Cartão de Acesso Nível 3.", "successMessage": "Trancas pneumáticas liberadas. Entrando no setor de risco..."},
}

BACK_DOORS = {
    "corridor": "entrance",
    "scp_173_room": "corridor",
    "scp_049_room": "corridor",
    "scp_096_room": "corridor",
    "scp_682_room": "corridor",
    "server_room": "corridor",
    "containment": "corridor",
}


def normalize_keycard(item_id: str) -> str | None:
    return KEYCARD_MAP.get(item_id, item_id if item_id and item_id.startswith("keycard_") else None)


def normalize_target_room(room_id: str) -> str | None:
    return TARGET_ROOM_MAP.get(room_id, room_id if room_id in TARGET_ROOM_MAP.values() else None)


def normalize_document_data(doc) -> dict | None:
    if doc is None:
        return None
    if isinstance(doc, dict):
        return doc
    if isinstance(doc, str):
        paragraphs = [p.strip() for p in doc.split(".") if p.strip()]
        content = []
        for i, p in enumerate(paragraphs):
            sentence = p.strip()
            if sentence and not sentence.endswith("."):
                sentence += "."
            content.append(sentence)
        if not content:
            content = [doc]
        return {"title": "ARQUIVO RECUPERADO", "content": content}
    return None


def build_travel_doors(room_id: str) -> list[dict]:
    doors = []

    back_target = BACK_DOORS.get(room_id)
    if back_target:
        doors.append({
            "id": f"door_back_{room_id}",
            "x": 50,
            "y": 90,
            "icon": "DoorOpen",
            "type": "travel",
            "label": f"Voltar para {BACK_DOORS.get(room_id, 'Corredor')}",
            "targetRoom": back_target,
        })

    if room_id == "entrance":
        doors.append({
            "id": "door_corridor",
            "x": 50,
            "y": 30,
            "icon": "DoorClosed",
            "type": "travel",
            "label": "Porta para o Corredor Leste",
            "targetRoom": "corridor",
            "requiredItem": "keycard_1",
            "failedMessage": "[ACESSO NEGADO] Requer Cartão de Acesso Nível 1.",
            "successMessage": "O leitor apitou verde. Porta destrancada.",
        })
    elif room_id == "corridor":
        for target, x_pos, icon in [
            ("scp_173_room", 20, "DoorClosed"),
            ("scp_049_room", 35, "DoorClosed"),
            ("scp_096_room", 55, "DoorClosed"),
            ("scp_682_room", 70, "DoorOpen"),
            ("server_room", 80, "Archive"),
            ("containment", 15, "Lock"),
        ]:
            req = ROOM_TRAVEL_REQUIREMENTS.get(("corridor", target), {})
            door = {
                "id": f"door_{target}",
                "x": x_pos,
                "y": 40,
                "icon": icon,
                "type": "travel",
                "label": GAME_ROOMS_ORIG.get(target, {}).get("name", target.replace("_", " ").title()),
                "targetRoom": target,
            }
            door.update(req)
            doors.append(door)

    return doors


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
            req = ROOM_TRAVEL_REQUIREMENTS.get((room_id, target), {})
            if req:
                result.update(req)
        else:
            return None

    if item["type"] == "pickup":
        pickup = normalize_keycard(item.get("pickupItem"))
        if pickup:
            result["pickupItem"] = pickup
            result["hideAfterInteract"] = True
            if not result.get("description"):
                result["description"] = f"Você pegou: {pickup}"

    required = item.get("requiredItem")
    if required:
        norm = normalize_keycard(required)
        if norm:
            result["requiredItem"] = norm
            if not result.get("failedMessage"):
                level = norm.split("_")[-1]
                result["failedMessage"] = f"[ACESSO NEGADO] Requer Cartão de Acesso Nível {level}."

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

    travel_items = []
    other_items = []

    for item in extracted.get("interactables", []):
        norm = normalize_interactable(item, room_id)
        if norm is None:
            continue
        if norm["type"] == "travel" and norm.get("targetRoom") in TARGET_ROOM_MAP.values():
            travel_items.append(norm)
        elif norm["type"] != "travel":
            other_items.append(norm)

    existing_ids = {obj["id"] for obj in merged["interactables"]}

    structural_doors = build_travel_doors(room_id)
    for door in structural_doors:
        if door["id"] not in existing_ids:
            merged["interactables"].append(door)
            existing_ids.add(door["id"])

    for item in other_items:
        if item["id"] not in existing_ids:
            merged["interactables"].append(item)
            existing_ids.add(item["id"])

    return merged


with open(GAME_DATA, "r", encoding="utf-8") as f:
    game_data = json.load(f)

GAME_ROOMS_ORIG = deepcopy(game_data["GAME_ROOMS"])

with open(EXTRACTED, "r", encoding="utf-8") as f:
    extracted = json.load(f)

for room_id, ext_room in extracted["rooms"].items():
    if room_id in game_data["GAME_ROOMS"]:
        game_data["GAME_ROOMS"][room_id] = merge_room(
            room_id, ext_room, game_data["GAME_ROOMS"][room_id]
        )
    else:
        merged = merge_room(room_id, ext_room, {"id": room_id, "name": ext_room.get("name", room_id), "description": "", "interactables": []})
        game_data["GAME_ROOMS"][room_id] = merged

for room_id, room in game_data["GAME_ROOMS"].items():
    if room_id.startswith("scp_") and room_id not in extracted["rooms"]:
        source = extracted["rooms"].get("scp_173_room")
        if source:
            game_data["GAME_ROOMS"][room_id] = merge_room(room_id, source, room)

with open(OUTPUT, "w", encoding="utf-8") as f:
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
    print(f"  {room_id}: {len(items)} itens {types}")
