import random


DEFAULT_W = 8.0
DEFAULT_H = 8.0

TYPE_SIZES = {
    "travel": {"width": 10.0, "height": 8.0},
    "pickup": {"width": 7.0, "height": 7.0},
    "inspect": {"width": 7.0, "height": 7.0},
    "terminal_read": {"width": 12.0, "height": 12.0},
}


def get_bbox(item: dict, default_w: float = DEFAULT_W, default_h: float = DEFAULT_H) -> tuple[float, float, float, float]:
    w = item.get("width", default_w)
    h = item.get("height", default_h)
    if item.get("width") and item.get("height"):
        return item["x"], item["y"], item["x"] + w, item["y"] + h
    return item["x"] - w / 2, item["y"] - h / 2, item["x"] + w / 2, item["y"] + h / 2


def bboxes_overlap(a: tuple, b: tuple) -> bool:
    return a[0] < b[2] and a[2] > b[0] and a[1] < b[3] and a[3] > b[1]


def overlap_pct(a: tuple, b: tuple) -> float:
    ix1 = max(a[0], b[0])
    iy1 = max(a[1], b[1])
    ix2 = min(a[2], b[2])
    iy2 = min(a[3], b[3])
    if ix1 >= ix2 or iy1 >= iy2:
        return 0.0
    i_area = (ix2 - ix1) * (iy2 - iy1)
    a_area = (a[2] - a[0]) * (a[3] - a[1])
    b_area = (b[2] - b[0]) * (b[3] - b[1])
    smaller = min(a_area, b_area)
    return (i_area / smaller * 100) if smaller > 0 else 0.0


def find_free_position(room_id: str, width: float, height: float, existing: list[dict]) -> tuple[float, float]:
    for attempt_y in range(20, 90, 8):
        for attempt_x in range(5, 95 - int(width), 10):
            x, y = float(attempt_x), float(attempt_y)
            x2, y2 = x + width, y + height
            overlap = False
            for e in existing:
                if not all(k in e for k in ('x', 'y', 'width', 'height')):
                    continue
                ex2, ey2 = e['x'] + e['width'], e['y'] + e['height']
                if x < ex2 and x2 > e['x'] and y < ey2 and y2 > e['y']:
                    overlap = True
                    break
            if not overlap:
                return (x, y)
    return (round(random.uniform(30, 60), 1), round(random.uniform(30, 60), 1))


def assign_hitboxes(rooms: dict) -> None:
    for room_id, room_data in rooms.items():
        for item in room_data["interactables"]:
            if not item.get("width") or not item.get("height"):
                itype = item.get("type", "inspect")
                sizes = TYPE_SIZES.get(itype, TYPE_SIZES["inspect"])
                item["width"] = sizes["width"]
                item["height"] = sizes["height"]
                print(f"  [{room_id}] Assigned hitbox to '{item['id']}' ({itype}): {sizes['width']}x{sizes['height']}")


def clamp_bounds(rooms: dict) -> None:
    for room_id, room_data in rooms.items():
        for item in room_data["interactables"]:
            x1, y1, x2, y2 = get_bbox(item)
            if x1 < 0 or y1 < 0 or x2 > 100 or y2 > 100:
                w = item.get("width", DEFAULT_W)
                h = item.get("height", DEFAULT_H)
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
                    half_w, half_h = w / 2, h / 2
                    if item["x"] - half_w < 0:
                        item["x"] = half_w
                    if item["y"] - half_h < 0:
                        item["y"] = half_h
                    if item["x"] + half_w > 100:
                        item["x"] = 100 - half_w
                    if item["y"] + half_h > 100:
                        item["y"] = 100 - half_h
                new = get_bbox(item)
                print(f"  [{room_id}] Clamped '{item['id']}' to ({new[0]:.1f},{new[1]:.1f})-({new[2]:.1f},{new[3]:.1f})")


def verify_no_overlaps(rooms: dict, threshold: float = 5.0) -> list[str]:
    issues = []
    for room_id, room_data in rooms.items():
        items = room_data["interactables"]
        seen = set()
        for item in items:
            if item["id"] in seen:
                issues.append(f"[{room_id}] DUPLICATE ID: {item['id']}")
            seen.add(item["id"])

        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                ba = get_bbox(items[i])
                bb = get_bbox(items[j])
                if bboxes_overlap(ba, bb):
                    oa = overlap_pct(ba, bb)
                    if oa > threshold:
                        issues.append(f"[{room_id}] OVERLAP: '{items[i]['id']}' <-> '{items[j]['id']}' ({oa:.1f}%)")

        for item in items:
            x1, y1, x2, y2 = get_bbox(item)
            if x1 < -1 or y1 < -1 or x2 > 101 or y2 > 101:
                issues.append(f"[{room_id}] OUT_OF_BOUNDS: '{item['id']}' ({x1:.1f},{y1:.1f})-({x2:.1f},{y2:.1f})")

    return issues
