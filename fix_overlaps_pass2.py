#!/usr/bin/env python3
"""
Fix the 18 remaining overlaps from the first pass.
These are items that already had width/height (from YOLO extraction)
and need repositioning to avoid overlaps.
"""

import json
from pathlib import Path

def get_bbox(item):
    w = item.get("width", 8)
    h = item.get("height", 8)
    if item.get("width") and item.get("height"):
        return item["x"], item["y"], item["x"] + w, item["y"] + h
    else:
        return item["x"] - w/2, item["y"] - h/2, item["x"] + w/2, item["y"] + h/2

def bboxes_overlap(a, b):
    return a[0] < b[2] and a[2] > b[0] and a[1] < b[3] and a[3] > b[1]

def overlap_pct(a, b):
    ix1 = max(a[0], b[0])
    iy1 = max(a[1], b[1])
    ix2 = min(a[2], b[2])
    iy2 = min(a[3], b[3])
    if ix1 >= ix2 or iy1 >= iy2:
        return 0
    i_area = (ix2-ix1)*(iy2-iy1)
    a_area = (a[2]-a[0])*(a[3]-a[1])
    b_area = (b[2]-b[0])*(b[3]-b[1])
    smaller = min(a_area, b_area)
    return (i_area/smaller*100) if smaller > 0 else 0

def main():
    data_path = Path(__file__).parent / "src" / "game_data.json"
    with open(data_path) as f:
        data = json.load(f)
    
    rooms = data["GAME_ROOMS"]
    
    # ==========================================
    # ENTRANCE: guard_desk + keycard overlap security_terminal_left
    # security_terminal_left is at (15,58) w:20 h:25 -> bbox (15,58)-(35,83)
    # This is a big area. Let's shrink it and reposition the smaller items around it.
    # ==========================================
    e_items = {i["id"]: i for i in rooms["entrance"]["interactables"]}
    
    # security_terminal_left is too large (20x25). Shrink to reasonable size.
    e_items["security_terminal_left"]["width"] = 14.0
    e_items["security_terminal_left"]["height"] = 18.0
    e_items["security_terminal_left"]["x"] = 3.0
    e_items["security_terminal_left"]["y"] = 52.0
    # Now bbox = (3,52)-(17,70)
    
    # guard_desk at (12,72) w:7 h:7 centered = (8.5,68.5)-(15.5,75.5) — no overlap with (3,52)-(17,70)
    # Actually overlap: 8.5<17 and 68.5<70 -> overlap! Move guard_desk right.
    e_items["guard_desk"]["x"] = 24.0
    e_items["guard_desk"]["y"] = 72.0
    # centered bbox = (20.5,68.5)-(27.5,75.5)
    
    # keycard_1_pickup at (28,78) w:7 h:7 centered = (24.5,74.5)-(31.5,81.5) — no overlap
    # Move slightly to ensure clearance
    e_items["keycard_1_pickup"]["x"] = 30.0
    e_items["keycard_1_pickup"]["y"] = 80.0
    
    # flavor_entrance_4 at (5,55) w:7 h:7 centered = (1.5,51.5)-(8.5,58.5) — overlaps terminal (3,52)-(17,70)
    e_items["flavor_entrance_4"]["x"] = 8.0
    e_items["flavor_entrance_4"]["y"] = 42.0
    
    print("Fixed entrance room overlaps")
    
    # ==========================================
    # CORRIDOR: wall_blood_prints at (85,15) w:12 h:70 -> bbox (85,15)-(97,85)
    # This overlaps: door_scp_682 (75,36)-(85,44), door_server (75,16)-(85,24), flavor_corridor_3
    # wall_blood_prints is a wall detail — make it narrower and on the far right
    # ==========================================
    c_items = {i["id"]: i for i in rooms["corridor"]["interactables"]}
    
    c_items["wall_blood_prints"]["x"] = 92.0
    c_items["wall_blood_prints"]["y"] = 10.0
    c_items["wall_blood_prints"]["width"] = 7.0
    c_items["wall_blood_prints"]["height"] = 55.0
    # bbox = (92,10)-(99,65)
    
    # Move flavor_corridor_3 (at 80,80) away from right side
    c_items["flavor_corridor_3"]["x"] = 82.0
    c_items["flavor_corridor_3"]["y"] = 78.0
    # centered = (78.5,74.5)-(85.5,81.5) — no overlap with (92,10)-(99,65)
    
    print("Fixed corridor room overlaps")
    
    # ==========================================
    # SCP ROOMS: terminal_scp_XXX_room overlaps terminal_scp_496 and mug_dr_angell
    # Also flavor_office_4 overlaps whiteboard_event_horizon
    # ==========================================
    scp_rooms = ["scp_173_room", "scp_049_room", "scp_096_room", "scp_682_room"]
    
    for room_id in scp_rooms:
        items = rooms[room_id]["interactables"]
        by_id = {i["id"]: i for i in items}
        
        # Room-specific terminal at (20,50) w:12 h:12 centered = (14,44)-(26,56)
        terminal_id = f"terminal_{room_id}"
        if terminal_id in by_id:
            # Move to top-left area, away from YOLO items
            by_id[terminal_id]["x"] = 10.0
            by_id[terminal_id]["y"] = 25.0
            by_id[terminal_id]["width"] = 12.0
            by_id[terminal_id]["height"] = 12.0
            # bbox = (4,19)-(16,31)
        
        # SCP-496 terminal (from YOLO) at (29.5,40.8) w:13.6 h:26 -> bbox (29.5,40.8)-(43.1,66.8)
        # This is fine if room terminal is at (4,19)-(16,31)
        
        # mug_dr_angell at (23.6,57.7) w:5.5 h:9.8 -> bbox (23.6,57.7)-(29.1,67.5)
        # No overlap with terminal at (4,19)-(16,31) ✓
        
        # whiteboard_event_horizon at (88,20) w:12 h:40 -> bbox (88,20)-(100,60)
        # flavor_office_4 was moved to (88,55) w:7 h:7 centered = (84.5,51.5)-(91.5,58.5)
        # Overlap: 84.5<100 and 91.5>88 and 51.5<60 and 58.5>20 -> YES
        # Move flavor_office_4 away from whiteboard
        for item in items:
            if item["id"].startswith("flavor_office") and item["id"].endswith("_4"):
                item["x"] = 92.0
                item["y"] = 65.0
                # centered = (88.5,61.5)-(95.5,68.5) — still close to whiteboard (88,20)-(100,60)
                # 88.5<100 and 95.5>88 and 61.5<60 -> NO! 61.5 > 60 ✓
        
        # Also need to check: periodic_table_wall at (31,12) w:10 h:15 -> bbox (31,12)-(41,27)
        # No overlap with room terminal at (4,19)-(16,31) ✓
        
        # desk_drawer_keycard at (23,70) w:10 h:15 -> bbox (23,70)-(33,85)
        # Check against scattered_papers at (38,72) w:24 h:10 -> bbox (38,72)-(62,82)
        # 23<62 and 33>38 -> NO, 33 < 38 ✓
        
        print(f"Fixed {room_id} overlaps")
    
    # ==========================================
    # SERVER ROOM: flavor_server_4 at (80,40) w:7 h:7 centered = (76.5,36.5)-(83.5,43.5)
    # overlaps server_block_b4 at (80,10) w:15 h:40 -> bbox (80,10)-(95,50)
    # 76.5<95 and 83.5>80 and 36.5<50 and 43.5>10 -> YES
    # ==========================================
    s_items = {i["id"]: i for i in rooms["server_room"]["interactables"]}
    
    # Move flavor_server_4 to the middle area between the two server blocks
    s_items["flavor_server_4"]["x"] = 50.0
    s_items["flavor_server_4"]["y"] = 42.0
    # centered = (46.5,38.5)-(53.5,45.5)
    # Check vs server_terminal at (44,24)-(56,36) — 46.5<56 and 53.5>44 and 38.5>36 -> NO, 38.5 > 36 ✓
    
    # Also verify flavor_server_1 at (25,60) centered = (21.5,56.5)-(28.5,63.5)
    # vs server_block_b1 at (5,10)-(20,50) — 21.5>20 ✓
    
    print("Fixed server_room overlaps")
    
    # ==========================================
    # FINAL VERIFICATION
    # ==========================================
    print(f"\n{'='*80}")
    print("FINAL VERIFICATION")
    print("=" * 80)
    
    all_issues = []
    for room_id, room_data in rooms.items():
        items = room_data["interactables"]
        for i in range(len(items)):
            for j in range(i+1, len(items)):
                ba = get_bbox(items[i])
                bb = get_bbox(items[j])
                if bboxes_overlap(ba, bb):
                    oa = overlap_pct(ba, bb)
                    if oa > 5:
                        all_issues.append(f"[{room_id}] '{items[i]['id']}' <-> '{items[j]['id']}' ({oa:.1f}%)")
        
        for item in items:
            x1, y1, x2, y2 = get_bbox(item)
            if x1 < -0.5 or y1 < -0.5 or x2 > 100.5 or y2 > 100.5:
                all_issues.append(f"[{room_id}] OUT_OF_BOUNDS: '{item['id']}' ({x1:.1f},{y1:.1f})-({x2:.1f},{y2:.1f})")
    
    if all_issues:
        print(f"\n⚠ {len(all_issues)} remaining issues:")
        for issue in all_issues:
            print(f"  {issue}")
    else:
        print("\n✓ All clear! No overlaps or out-of-bounds items.")
    
    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"\nWrote fixed data to {data_path}")


if __name__ == "__main__":
    main()
