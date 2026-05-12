#!/usr/bin/env python3
"""
Auto-fix game_data.json:
1. Remove duplicate back-door entries
2. Deduplicate corridor doors (scp_682_room + server_room same position)
3. Prefix duplicate SCP-room IDs with room name
4. Assign width/height to all items without explicit hitboxes
5. Reposition overlapping items
6. Clamp out-of-bounds items
"""

import json
from pathlib import Path
from copy import deepcopy

DEFAULT_W = 8.0
DEFAULT_H = 8.0

TYPE_SIZES = {
    "travel":        {"width": 10.0, "height": 8.0},
    "pickup":        {"width": 7.0,  "height": 7.0},
    "inspect":       {"width": 7.0,  "height": 7.0},
    "terminal_read": {"width": 12.0, "height": 12.0},
}

# IDs that are duplicated across SCP rooms (from merge_extracted.py)
CROSS_ROOM_DUP_IDS = [
    "terminal_scp_496",
    "mug_dr_angell",
    "whiteboard_event_horizon",
    "scattered_papers_floor",
    "periodic_table_wall",
    "desk_drawer_keycard",
]

# Duplicate door pairs to remove (keep the first, remove the second)
DUPLICATE_DOOR_REMOVALS = {
    "corridor": ["door_back_corridor", "door_server_room"],
    "server_room": ["door_back_server_room"],
    "containment": ["door_back_containment"],
}


def get_bbox(item):
    """Get bounding box as (x1, y1, x2, y2)."""
    w = item.get("width", DEFAULT_W)
    h = item.get("height", DEFAULT_H)
    if item.get("width") and item.get("height"):
        x1 = item["x"]
        y1 = item["y"]
        x2 = x1 + w
        y2 = y1 + h
    else:
        x1 = item["x"] - w / 2
        y1 = item["y"] - h / 2
        x2 = item["x"] + w / 2
        y2 = item["y"] + h / 2
    return x1, y1, x2, y2


def bboxes_overlap(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return ax1 < bx2 and ax2 > bx1 and ay1 < by2 and ay2 > by1


def overlap_area_pct(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1 = max(ax1, bx1)
    iy1 = max(ay1, by1)
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    if ix1 >= ix2 or iy1 >= iy2:
        return 0.0
    i_area = (ix2 - ix1) * (iy2 - iy1)
    a_area = (ax2 - ax1) * (ay2 - ay1)
    b_area = (bx2 - bx1) * (by2 - by1)
    smaller = min(a_area, b_area)
    return (i_area / smaller * 100) if smaller > 0 else 0.0


def fix_duplicate_doors(rooms):
    """Remove duplicate back-door entries."""
    for room_id, ids_to_remove in DUPLICATE_DOOR_REMOVALS.items():
        if room_id in rooms:
            items = rooms[room_id]["interactables"]
            rooms[room_id]["interactables"] = [
                i for i in items if i["id"] not in ids_to_remove
            ]
            print(f"  [{room_id}] Removed duplicate doors: {ids_to_remove}")


def fix_duplicate_ids(rooms):
    """Prefix duplicate IDs in SCP rooms with room name."""
    scp_rooms = ["scp_049_room", "scp_096_room", "scp_682_room"]
    
    for room_id in scp_rooms:
        if room_id not in rooms:
            continue
        prefix = room_id.replace("_room", "")  # e.g., "scp_049"
        items = rooms[room_id]["interactables"]
        for item in items:
            if item["id"] in CROSS_ROOM_DUP_IDS:
                old_id = item["id"]
                new_id = f"{prefix}_{old_id}"
                item["id"] = new_id
                print(f"  [{room_id}] Renamed '{old_id}' -> '{new_id}'")


def fix_corridor_door_overlaps(rooms):
    """Fix corridor doors that overlap: scp_682 and server_room at (80,40)."""
    if "corridor" not in rooms:
        return
    items = rooms["corridor"]["interactables"]
    for item in items:
        if item["id"] == "door_scp_682_room":
            item["x"] = 80.0
            item["y"] = 40.0
            print(f"  [corridor] door_scp_682_room moved to (80, 40)")
        elif item["id"] == "door_server":
            item["x"] = 80.0
            item["y"] = 20.0
            print(f"  [corridor] door_server kept at (80, 20)")


def assign_hitboxes(rooms):
    """Assign width/height to items missing explicit hitboxes."""
    for room_id, room_data in rooms.items():
        items = room_data["interactables"]
        for item in items:
            if not item.get("width") or not item.get("height"):
                itype = item.get("type", "inspect")
                sizes = TYPE_SIZES.get(itype, TYPE_SIZES["inspect"])
                item["width"] = sizes["width"]
                item["height"] = sizes["height"]
                print(f"  [{room_id}] Assigned hitbox to '{item['id']}' ({itype}): {sizes['width']}x{sizes['height']}")


def clamp_bounds(rooms):
    """Clamp items that go out of the 0-100% viewport."""
    for room_id, room_data in rooms.items():
        items = room_data["interactables"]
        for item in items:
            x1, y1, x2, y2 = get_bbox(item)
            if x1 < 0 or y1 < 0 or x2 > 100 or y2 > 100:
                w = item.get("width", DEFAULT_W)
                h = item.get("height", DEFAULT_H)
                
                # For top-left anchored items
                if item.get("width") and item.get("height"):
                    if x2 > 100:
                        item["x"] = 100 - w
                    if y2 > 100:
                        item["y"] = 100 - h
                    if item["x"] < 0:
                        item["x"] = 0
                    if item["y"] < 0:
                        item["y"] = 0
                else:
                    # Center-anchored: clamp center so icon stays in view
                    half_w = w / 2
                    half_h = h / 2
                    if item["x"] - half_w < 0:
                        item["x"] = half_w
                    if item["y"] - half_h < 0:
                        item["y"] = half_h
                    if item["x"] + half_w > 100:
                        item["x"] = 100 - half_w
                    if item["y"] + half_h > 100:
                        item["y"] = 100 - half_h
                
                new_x1, new_y1, new_x2, new_y2 = get_bbox(item)
                print(f"  [{room_id}] Clamped '{item['id']}' to ({new_x1:.1f},{new_y1:.1f})-({new_x2:.1f},{new_y2:.1f})")


def fix_entrance_overlaps(rooms):
    """
    Fix entrance room overlaps:
    - guard_desk (20,70) overlaps keycard_1_pickup (25,75) — move keycard slightly
    - security_terminal_left (15,58) with w:20 h:25 overlaps guard_desk (20,70)
    - flavor_entrance_2 (30,85) overlaps floor_debris_helmet (31,88)
    - flavor_entrance_4 (10,60) overlaps security_terminal_left
    """
    if "entrance" not in rooms:
        return
    items = rooms["entrance"]["interactables"]
    by_id = {i["id"]: i for i in items}
    
    # keycard_1_pickup is found "under the desk" so it should be near guard_desk
    # but they need separate hitboxes. Move keycard slightly right-down.
    if "keycard_1_pickup" in by_id:
        by_id["keycard_1_pickup"]["x"] = 28.0
        by_id["keycard_1_pickup"]["y"] = 78.0
        print(f"  [entrance] Moved keycard_1_pickup to (28, 78)")
    
    # guard_desk overlaps security_terminal_left — they're conceptually the same area
    # Remove guard_desk since security_terminal_left is richer (has documentData)
    # But guard_desk is a separate interaction. Move guard_desk down-right.
    if "guard_desk" in by_id:
        by_id["guard_desk"]["x"] = 12.0
        by_id["guard_desk"]["y"] = 72.0
        print(f"  [entrance] Moved guard_desk to (12, 72)")
    
    # flavor_entrance_4 at (10,60) overlaps security_terminal_left at (15,58)
    if "flavor_entrance_4" in by_id:
        by_id["flavor_entrance_4"]["x"] = 5.0
        by_id["flavor_entrance_4"]["y"] = 55.0
        print(f"  [entrance] Moved flavor_entrance_4 (radio) to (5, 55)")
    
    # flavor_entrance_2 at (30,85) overlaps floor_debris_helmet at (31,88)
    if "flavor_entrance_2" in by_id:
        by_id["flavor_entrance_2"]["x"] = 35.0
        by_id["flavor_entrance_2"]["y"] = 92.0
        print(f"  [entrance] Moved flavor_entrance_2 (docs) to (35, 92)")


def fix_scp_room_overlaps(rooms):
    """
    Fix SCP room overlaps. The shared items from YOLO extraction need repositioning
    for each specific room. Also flavor items at (10,40)+(15,45) and (15,45)+terminal overlap.
    """
    scp_rooms = ["scp_173_room", "scp_049_room", "scp_096_room", "scp_682_room"]
    
    # Custom positions per room for the shared items
    # Each entry: {item_id_prefix: {x, y, width, height}}
    # The shared items have IDs like: terminal_scp_496, mug_dr_angell, etc.
    # In 049/096/682 rooms they get prefixed: scp_049_terminal_scp_496, etc.
    
    for room_id in scp_rooms:
        if room_id not in rooms:
            continue
        items = rooms[room_id]["interactables"]
        by_id = {i["id"]: i for i in items}
        
        # Back door overlaps scattered_papers_floor (which is at y:80, h:20, so y2=100)
        # Back door is at (50, 90). Move back door to bottom center, papers start at y:70
        back_door_id = f"door_back_{room_id}"
        if back_door_id in by_id:
            by_id[back_door_id]["x"] = 50.0
            by_id[back_door_id]["y"] = 88.0
            # Make back door narrower to not overlap papers
            by_id[back_door_id]["width"] = 10.0
            by_id[back_door_id]["height"] = 8.0
            print(f"  [{room_id}] Back door set to (50, 88) 10x8")
        
        # scattered_papers_floor — move it to not overlap the back door
        papers_id = "scattered_papers_floor"
        if room_id != "scp_173_room":
            papers_id = f"{room_id.replace('_room', '')}_scattered_papers_floor"
        if papers_id in by_id:
            by_id[papers_id]["x"] = 38.0
            by_id[papers_id]["y"] = 72.0
            by_id[papers_id]["width"] = 24.0
            by_id[papers_id]["height"] = 10.0
            print(f"  [{room_id}] '{papers_id}' moved to (38, 72) 24x10")
        
        # flavor_office_X / flavor_office_049_X items — these are generic and close together
        # Find all flavor items for this room and spread them
        flavor_items = [i for i in items if i["id"].startswith("flavor_office")]
        if len(flavor_items) >= 2:
            # Reposition: spread across the room
            # flavor 1: bottom right area
            # flavor 2: top left area  
            # flavor 3: middle left
            # flavor 4: right middle
            positions = [
                (75.0, 78.0),   # bottom right
                (8.0, 35.0),    # top left
                (8.0, 58.0),    # middle left
                (88.0, 55.0),   # right middle
            ]
            for idx, item in enumerate(flavor_items):
                if idx < len(positions):
                    item["x"] = positions[idx][0]
                    item["y"] = positions[idx][1]
                    item["width"] = 7.0
                    item["height"] = 7.0
                    print(f"  [{room_id}] Moved '{item['id']}' to {positions[idx]} 7x7")
        
        # terminal_scp_XXX_room overlaps flavor_office_3 (at 15,45)
        # The room-specific terminal at (20,50) — move flavor_office_3 away
        # (already handled above by spreading flavors)
        
        # keycard_3_pickup — move to a clear spot
        keycard_ids = [i for i in items if i["id"].startswith("keycard_3_pickup")]
        for item in keycard_ids:
            item["x"] = 78.0
            item["y"] = 68.0
            item["width"] = 7.0
            item["height"] = 7.0
            print(f"  [{room_id}] Moved '{item['id']}' to (78, 68) 7x7")


def fix_server_room(rooms):
    """Fix server_room: server blocks extend beyond 100% height, keycard overlaps B4."""
    if "server_room" not in rooms:
        return
    items = rooms["server_room"]["interactables"]
    by_id = {i["id"]: i for i in items}
    
    # server_block_b1 height 80 goes to 130% — reduce to fit
    if "server_block_b1" in by_id:
        by_id["server_block_b1"]["width"] = 15.0
        by_id["server_block_b1"]["height"] = 40.0
        by_id["server_block_b1"]["x"] = 5.0
        by_id["server_block_b1"]["y"] = 10.0
        print(f"  [server_room] server_block_b1 -> (5, 10) 15x40")
    
    # server_block_b4 same issue
    if "server_block_b4" in by_id:
        by_id["server_block_b4"]["width"] = 15.0
        by_id["server_block_b4"]["height"] = 40.0
        by_id["server_block_b4"]["x"] = 80.0
        by_id["server_block_b4"]["y"] = 10.0
        print(f"  [server_room] server_block_b4 -> (80, 10) 15x40")
    
    # keycard_3_pickup at (80,70) overlaps server_block_b4
    if "keycard_3_pickup" in by_id:
        by_id["keycard_3_pickup"]["x"] = 82.0
        by_id["keycard_3_pickup"]["y"] = 60.0
        print(f"  [server_room] keycard_3_pickup -> (82, 60)")
    
    # flavor_server_1 at (20,60) overlaps server_block_b1 at (5,10,20,50)
    # After repositioning b1 to (5,10) 15x40 -> bbox (5,10)-(20,50)
    # flavor_server_1 at (20,60) with 8x8 centered = (16,56)-(24,64) — no overlap with new b1
    # But let's move it slightly right
    if "flavor_server_1" in by_id:
        by_id["flavor_server_1"]["x"] = 25.0
        by_id["flavor_server_1"]["y"] = 60.0
        print(f"  [server_room] flavor_server_1 -> (25, 60)")
    
    # flavor_server_3 at (50,85) overlaps back door at (50,90)
    if "flavor_server_3" in by_id:
        by_id["flavor_server_3"]["x"] = 40.0
        by_id["flavor_server_3"]["y"] = 82.0
        print(f"  [server_room] flavor_server_3 -> (40, 82)")


def fix_containment(rooms):
    """Fix containment: duplicate back doors (already removed), out-of-bounds control panel."""
    if "containment" not in rooms:
        return
    items = rooms["containment"]["interactables"]
    by_id = {i["id"]: i for i in items}
    
    # control_panel_right at (97.6, 67.4) w:4.7 h:21.6 -> extends to 102.3%
    if "control_panel_right" in by_id:
        by_id["control_panel_right"]["x"] = 93.0
        by_id["control_panel_right"]["y"] = 65.0
        by_id["control_panel_right"]["width"] = 7.0
        by_id["control_panel_right"]["height"] = 25.0
        print(f"  [containment] control_panel_right -> (93, 65) 7x25")


def verify_no_overlaps(rooms):
    """Final check: verify no overlaps remain."""
    issues = []
    for room_id, room_data in rooms.items():
        items = room_data["interactables"]
        # Check duplicate IDs within room
        seen = set()
        for item in items:
            if item["id"] in seen:
                issues.append(f"[{room_id}] DUPLICATE ID: {item['id']}")
            seen.add(item["id"])
        
        # Check overlaps
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a = items[i]
                b = items[j]
                ba = get_bbox(a)
                bb = get_bbox(b)
                if bboxes_overlap(ba, bb):
                    oa = overlap_area_pct(ba, bb)
                    if oa > 5:  # Only report significant overlaps
                        issues.append(f"[{room_id}] OVERLAP: '{a['id']}' <-> '{b['id']}' ({oa:.1f}%)")
        
        # Check out of bounds
        for item in items:
            x1, y1, x2, y2 = get_bbox(item)
            if x1 < -1 or y1 < -1 or x2 > 101 or y2 > 101:
                issues.append(f"[{room_id}] OUT_OF_BOUNDS: '{item['id']}' ({x1:.1f},{y1:.1f})-({x2:.1f},{y2:.1f})")
    
    return issues


def main():
    data_path = Path(__file__).parent / "src" / "game_data.json"
    with open(data_path) as f:
        data = json.load(f)
    
    rooms = data["GAME_ROOMS"]
    
    print("=" * 80)
    print("STEP 1: Remove duplicate back-door entries")
    print("=" * 80)
    fix_duplicate_doors(rooms)
    
    print(f"\n{'=' * 80}")
    print("STEP 2: Prefix duplicate SCP-room IDs")
    print("=" * 80)
    fix_duplicate_ids(rooms)
    
    print(f"\n{'=' * 80}")
    print("STEP 3: Fix corridor door overlaps")
    print("=" * 80)
    fix_corridor_door_overlaps(rooms)
    
    print(f"\n{'=' * 80}")
    print("STEP 4: Fix entrance room overlaps")
    print("=" * 80)
    fix_entrance_overlaps(rooms)
    
    print(f"\n{'=' * 80}")
    print("STEP 5: Fix SCP room overlaps and reposition flavor items")
    print("=" * 80)
    fix_scp_room_overlaps(rooms)
    
    print(f"\n{'=' * 80}")
    print("STEP 6: Fix server room")
    print("=" * 80)
    fix_server_room(rooms)
    
    print(f"\n{'=' * 80}")
    print("STEP 7: Fix containment room")
    print("=" * 80)
    fix_containment(rooms)
    
    print(f"\n{'=' * 80}")
    print("STEP 8: Assign hitboxes to all items")
    print("=" * 80)
    assign_hitboxes(rooms)
    
    print(f"\n{'=' * 80}")
    print("STEP 9: Clamp out-of-bounds items")
    print("=" * 80)
    clamp_bounds(rooms)
    
    # Verify
    print(f"\n{'=' * 80}")
    print("STEP 10: Verify no overlaps remain")
    print("=" * 80)
    issues = verify_no_overlaps(rooms)
    if issues:
        print(f"\n⚠ {len(issues)} remaining issues:")
        for issue in issues:
            print(f"  {issue}")
    else:
        print("\n✓ No overlaps or out-of-bounds items detected!")
    
    # Cross-room duplicate check
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
            print(f"  '{iid}' -> {room_ids}")
    else:
        print("\n✓ No cross-room duplicate IDs!")
    
    # Write output
    output_path = data_path  # overwrite in-place
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\nWrote fixed data to {output_path}")


if __name__ == "__main__":
    main()
