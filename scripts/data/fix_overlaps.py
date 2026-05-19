#!/usr/bin/env python3
"""
Auto-fix game_data.json:
Pass 1 — structural fixes (duplicate doors, IDs, hitboxes, bounds)
Pass 2 — reposition specific overlapping items

Merged from fix_overlaps.py + fix_overlaps_pass2.py into a single script.
"""

import json
from scripts.shared.config import GAME_DATA_PATH
from scripts.shared.geometry import (
    get_bbox, bboxes_overlap, overlap_pct,
    assign_hitboxes, clamp_bounds, verify_no_overlaps,
)

CROSS_ROOM_DUP_IDS = [
    "terminal_scp_496",
    "mug_dr_angell",
    "whiteboard_event_horizon",
    "scattered_papers_floor",
    "periodic_table_wall",
    "desk_drawer_keycard",
]

DUPLICATE_DOOR_REMOVALS = {
    "corridor": ["door_back_corridor", "door_server_room"],
    "server_room": ["door_back_server_room"],
    "containment": ["door_back_containment"],
}


def fix_duplicate_doors(rooms):
    for room_id, ids_to_remove in DUPLICATE_DOOR_REMOVALS.items():
        if room_id in rooms:
            items = rooms[room_id]["interactables"]
            rooms[room_id]["interactables"] = [
                i for i in items if i["id"] not in ids_to_remove
            ]
            print(f" [{room_id}] Removed duplicate doors: {ids_to_remove}")


def fix_duplicate_ids(rooms):
    scp_rooms = ["scp_049_room", "scp_096_room", "scp_682_room"]
    for room_id in scp_rooms:
        if room_id not in rooms:
            continue
        prefix = room_id.replace("_room", "")
        items = rooms[room_id]["interactables"]
        for item in items:
            if item["id"] in CROSS_ROOM_DUP_IDS:
                old_id = item["id"]
                new_id = f"{prefix}_{old_id}"
                item["id"] = new_id
                print(f" [{room_id}] Renamed '{old_id}' -> '{new_id}'")


def fix_corridor_door_overlaps(rooms):
    if "corridor" not in rooms:
        return
    items = rooms["corridor"]["interactables"]
    for item in items:
        if item["id"] == "door_scp_682_room":
            item["x"] = 80.0
            item["y"] = 40.0
            print(f" [corridor] door_scp_682_room moved to (80, 40)")
        elif item["id"] == "door_server":
            item["x"] = 80.0
            item["y"] = 20.0
            print(f" [corridor] door_server kept at (80, 20)")


def fix_entrance_overlaps(rooms):
    if "entrance" not in rooms:
        return
    items = rooms["entrance"]["interactables"]
    by_id = {i["id"]: i for i in items}

    if "keycard_1_pickup" in by_id:
        by_id["keycard_1_pickup"]["x"] = 28.0
        by_id["keycard_1_pickup"]["y"] = 78.0
        print(f" [entrance] Moved keycard_1_pickup to (28, 78)")

    if "guard_desk" in by_id:
        by_id["guard_desk"]["x"] = 12.0
        by_id["guard_desk"]["y"] = 72.0
        print(f" [entrance] Moved guard_desk to (12, 72)")

    if "flavor_entrance_4" in by_id:
        by_id["flavor_entrance_4"]["x"] = 5.0
        by_id["flavor_entrance_4"]["y"] = 55.0
        print(f" [entrance] Moved flavor_entrance_4 (radio) to (5, 55)")

    if "flavor_entrance_2" in by_id:
        by_id["flavor_entrance_2"]["x"] = 35.0
        by_id["flavor_entrance_2"]["y"] = 92.0
        print(f" [entrance] Moved flavor_entrance_2 (docs) to (35, 92)")


def fix_scp_room_overlaps(rooms):
    scp_rooms = ["scp_173_room", "scp_049_room", "scp_096_room", "scp_682_room"]

    for room_id in scp_rooms:
        if room_id not in rooms:
            continue
        items = rooms[room_id]["interactables"]
        by_id = {i["id"]: i for i in items}

        back_door_id = f"door_back_{room_id}"
        if back_door_id in by_id:
            by_id[back_door_id]["x"] = 50.0
            by_id[back_door_id]["y"] = 88.0
            by_id[back_door_id]["width"] = 10.0
            by_id[back_door_id]["height"] = 8.0
            print(f" [{room_id}] Back door set to (50, 88) 10x8")

        papers_id = "scattered_papers_floor"
        if room_id != "scp_173_room":
            papers_id = f"{room_id.replace('_room', '')}_scattered_papers_floor"
        if papers_id in by_id:
            by_id[papers_id]["x"] = 38.0
            by_id[papers_id]["y"] = 72.0
            by_id[papers_id]["width"] = 24.0
            by_id[papers_id]["height"] = 10.0
            print(f" [{room_id}] '{papers_id}' moved to (38, 72) 24x10")

        flavor_items = [i for i in items if i["id"].startswith("flavor_office")]
        if len(flavor_items) >= 2:
            positions = [
                (75.0, 78.0),
                (8.0, 35.0),
                (8.0, 58.0),
                (88.0, 55.0),
            ]
            for idx, item in enumerate(flavor_items):
                if idx < len(positions):
                    item["x"] = positions[idx][0]
                    item["y"] = positions[idx][1]
                    item["width"] = 7.0
                    item["height"] = 7.0
                    print(f" [{room_id}] Moved '{item['id']}' to {positions[idx]} 7x7")

        keycard_ids = [i for i in items if i["id"].startswith("keycard_3_pickup")]
        for item in keycard_ids:
            item["x"] = 78.0
            item["y"] = 68.0
            item["width"] = 7.0
            item["height"] = 7.0
            print(f" [{room_id}] Moved '{item['id']}' to (78, 68) 7x7")


def fix_server_room(rooms):
    if "server_room" not in rooms:
        return
    items = rooms["server_room"]["interactables"]
    by_id = {i["id"]: i for i in items}

    if "server_block_b1" in by_id:
        by_id["server_block_b1"]["width"] = 15.0
        by_id["server_block_b1"]["height"] = 40.0
        by_id["server_block_b1"]["x"] = 5.0
        by_id["server_block_b1"]["y"] = 10.0
        print(f" [server_room] server_block_b1 -> (5, 10) 15x40")

    if "server_block_b4" in by_id:
        by_id["server_block_b4"]["width"] = 15.0
        by_id["server_block_b4"]["height"] = 40.0
        by_id["server_block_b4"]["x"] = 80.0
        by_id["server_block_b4"]["y"] = 10.0
        print(f" [server_room] server_block_b4 -> (80, 10) 15x40")

    if "keycard_3_pickup" in by_id:
        by_id["keycard_3_pickup"]["x"] = 82.0
        by_id["keycard_3_pickup"]["y"] = 60.0
        print(f" [server_room] keycard_3_pickup -> (82, 60)")

    if "flavor_server_1" in by_id:
        by_id["flavor_server_1"]["x"] = 25.0
        by_id["flavor_server_1"]["y"] = 60.0
        print(f" [server_room] flavor_server_1 -> (25, 60)")

    if "flavor_server_3" in by_id:
        by_id["flavor_server_3"]["x"] = 40.0
        by_id["flavor_server_3"]["y"] = 82.0
        print(f" [server_room] flavor_server_3 -> (40, 82)")


def fix_containment(rooms):
    if "containment" not in rooms:
        return
    items = rooms["containment"]["interactables"]
    by_id = {i["id"]: i for i in items}

    if "control_panel_right" in by_id:
        by_id["control_panel_right"]["x"] = 93.0
        by_id["control_panel_right"]["y"] = 65.0
        by_id["control_panel_right"]["width"] = 7.0
        by_id["control_panel_right"]["height"] = 25.0
        print(f" [containment] control_panel_right -> (93, 65) 7x25")


def fix_pass2_entrance(rooms):
    if "entrance" not in rooms:
        return
    e_items = {i["id"]: i for i in rooms["entrance"]["interactables"]}

    if "security_terminal_left" in e_items:
        e_items["security_terminal_left"]["width"] = 14.0
        e_items["security_terminal_left"]["height"] = 18.0
        e_items["security_terminal_left"]["x"] = 3.0
        e_items["security_terminal_left"]["y"] = 52.0

    if "guard_desk" in e_items:
        e_items["guard_desk"]["x"] = 24.0
        e_items["guard_desk"]["y"] = 72.0

    if "keycard_1_pickup" in e_items:
        e_items["keycard_1_pickup"]["x"] = 30.0
        e_items["keycard_1_pickup"]["y"] = 80.0

    if "flavor_entrance_4" in e_items:
        e_items["flavor_entrance_4"]["x"] = 8.0
        e_items["flavor_entrance_4"]["y"] = 42.0

    print("Fixed entrance room overlaps (pass 2)")


def fix_pass2_corridor(rooms):
    if "corridor" not in rooms:
        return
    c_items = {i["id"]: i for i in rooms["corridor"]["interactables"]}

    if "wall_blood_prints" in c_items:
        c_items["wall_blood_prints"]["x"] = 92.0
        c_items["wall_blood_prints"]["y"] = 10.0
        c_items["wall_blood_prints"]["width"] = 7.0
        c_items["wall_blood_prints"]["height"] = 55.0

    if "flavor_corridor_3" in c_items:
        c_items["flavor_corridor_3"]["x"] = 82.0
        c_items["flavor_corridor_3"]["y"] = 78.0

    print("Fixed corridor room overlaps (pass 2)")


def fix_pass2_scp_rooms(rooms):
    scp_rooms = ["scp_173_room", "scp_049_room", "scp_096_room", "scp_682_room"]
    for room_id in scp_rooms:
        if room_id not in rooms:
            continue
        items = rooms[room_id]["interactables"]
        by_id = {i["id"]: i for i in items}

        terminal_id = f"terminal_{room_id}"
        if terminal_id in by_id:
            by_id[terminal_id]["x"] = 10.0
            by_id[terminal_id]["y"] = 25.0
            by_id[terminal_id]["width"] = 12.0
            by_id[terminal_id]["height"] = 12.0

        for item in items:
            if item["id"].startswith("flavor_office") and item["id"].endswith("_4"):
                item["x"] = 92.0
                item["y"] = 65.0

        print(f"Fixed {room_id} overlaps (pass 2)")


def fix_pass2_server_room(rooms):
    if "server_room" not in rooms:
        return
    s_items = {i["id"]: i for i in rooms["server_room"]["interactables"]}

    if "flavor_server_4" in s_items:
        s_items["flavor_server_4"]["x"] = 50.0
        s_items["flavor_server_4"]["y"] = 42.0

    print("Fixed server_room overlaps (pass 2)")


def main():
    with open(GAME_DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    rooms = data["GAME_ROOMS"]

    print("=" * 80)
    print("PASS 1: Structural fixes")
    print("=" * 80)

    steps = [
        ("Remove duplicate back-door entries", fix_duplicate_doors),
        ("Prefix duplicate SCP-room IDs", fix_duplicate_ids),
        ("Fix corridor door overlaps", fix_corridor_door_overlaps),
        ("Fix entrance room overlaps", fix_entrance_overlaps),
        ("Fix SCP room overlaps and reposition flavor items", fix_scp_room_overlaps),
        ("Fix server room", fix_server_room),
        ("Fix containment room", fix_containment),
    ]

    for i, (label, fn) in enumerate(steps, 1):
        print(f"\n--- Step {i}: {label} ---")
        fn(rooms)

    print("\n--- Assign hitboxes to all items ---")
    assign_hitboxes(rooms)

    print("\n--- Clamp out-of-bounds items ---")
    clamp_bounds(rooms)

    issues = verify_no_overlaps(rooms)
    if issues:
        print(f"\n⚠ {len(issues)} issues after pass 1:")
        for issue in issues:
            print(f" {issue}")
    else:
        print("\n✓ No overlaps after pass 1!")

    print(f"\n{'=' * 80}")
    print("PASS 2: Reposition remaining overlapping items")
    print("=" * 80)

    fix_pass2_entrance(rooms)
    fix_pass2_corridor(rooms)
    fix_pass2_scp_rooms(rooms)
    fix_pass2_server_room(rooms)

    print(f"\n{'=' * 80}")
    print("FINAL VERIFICATION")
    print("=" * 80)

    all_issues = verify_no_overlaps(rooms)
    if all_issues:
        print(f"\n⚠ {len(all_issues)} remaining issues:")
        for issue in all_issues:
            print(f" {issue}")
    else:
        print("\n✓ All clear! No overlaps or out-of-bounds items.")

    print(f"\n{'=' * 80}")
    print("CROSS-ROOM DUPLICATE ID CHECK")
    print("=" * 80)
    id_to_rooms = {}
    for room_id, room_data in rooms.items():
        for item in room_data["interactables"]:
            iid = item["id"]
            if iid not in id_to_rooms:
                id_to_rooms[iid] = []
            id_to_rooms[iid].append(room_id)

    cross_dups = {k: v for k, v in id_to_rooms.items() if len(v) > 1}
    if cross_dups:
        print(f"\n⚠ {len(cross_dups)} cross-room duplicate IDs still exist:")
        for iid, room_ids in sorted(cross_dups.items()):
            print(f" '{iid}' -> {room_ids}")
    else:
        print("\n✓ No cross-room duplicate IDs!")

    with open(GAME_DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\nWrote fixed data to {GAME_DATA_PATH}")


if __name__ == "__main__":
    main()
