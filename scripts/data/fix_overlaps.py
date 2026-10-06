#!/usr/bin/env python3
"""
Auto-fix game_data.json:
- Assign default hitboxes to items missing width/height
- Clamp items within 0-100 bounds
- Verify no overlapping interactables
- Check cross-room duplicate IDs

Generic (noir-game agnostic) — no per-room hardcoded positions.
"""

import json
from scripts.shared.config import GAME_DATA_PATH
from scripts.shared.geometry import (
    assign_hitboxes, clamp_bounds, verify_no_overlaps,
)


def find_cross_room_duplicates(rooms: dict) -> dict[str, list[str]]:
    id_to_rooms: dict[str, list[str]] = {}
    for room_id, room_data in rooms.items():
        for item in room_data["interactables"]:
            iid = item["id"]
            if iid not in id_to_rooms:
                id_to_rooms[iid] = []
            id_to_rooms[iid].append(room_id)
    return {k: v for k, v in id_to_rooms.items() if len(v) > 1}


def fix_cross_room_duplicates(rooms: dict) -> None:
    cross_dups = find_cross_room_duplicates(rooms)
    if not cross_dups:
        return
    for iid, room_ids in sorted(cross_dups.items()):
        for idx, room_id in enumerate(room_ids[1:], 1):
            items = rooms[room_id]["interactables"]
            for item in items:
                if item["id"] == iid:
                    new_id = f"{room_id}_{iid}"
                    item["id"] = new_id
                    print(f" [{room_id}] Renamed '{iid}' -> '{new_id}'")


def main():
    with open(GAME_DATA_PATH, encoding="utf-8") as f:
        data = json.load(f)

    rooms = data["GAME_ROOMS"]

    print("=" * 80)
    print("PASS 1: Fix cross-room duplicate IDs")
    print("=" * 80)
    fix_cross_room_duplicates(rooms)

    print("\n--- Assign hitboxes to items missing width/height ---")
    assign_hitboxes(rooms)

    print("\n--- Clamp out-of-bounds items ---")
    clamp_bounds(rooms)

    issues = verify_no_overlaps(rooms)
    if issues:
        print(f"\n⚠ {len(issues)} overlap issues:")
        for issue in issues:
            print(f"  {issue}")
    else:
        print("\n✓ No overlaps!")

    print(f"\n{'=' * 80}")
    print("CROSS-ROOM DUPLICATE ID CHECK")
    print("=" * 80)

    cross_dups = find_cross_room_duplicates(rooms)
    if cross_dups:
        print(f"\n⚠ {len(cross_dups)} cross-room duplicate IDs:")
        for iid, room_ids in sorted(cross_dups.items()):
            print(f"  '{iid}' -> {room_ids}")
    else:
        print("\n✓ No cross-room duplicate IDs!")

    with open(GAME_DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\nWrote fixed data to {GAME_DATA_PATH}")


if __name__ == "__main__":
    main()
