#!/usr/bin/env python3
"""Audit room background images using Gemini vision via OpenRouter.
Analyzes each background for visible elements, objects, positions."""

import base64
import json
import sys
import time

from scripts.shared.config import NOIR_IMAGE_DIR, VISION_MODEL
from scripts.shared.openrouter import vision_query, HEADERS
from scripts.shared.ipv4_fix import force_ipv4

ROOMS = [
    "escritorio",
    "rua_chuva",
    "bar",
    "escola",
    "diretoria",
    "delegacia",
    "beco",
    "armazem",
]

PROMPT_TEMPLATE = """You are auditing background art for a noir detective video game.
Analyze this image carefully and list EVERY visible object, element, and feature in the scene.

For each element, provide:
1. A short name (e.g. "wooden desk", "window with rain", "filing cabinet")
2. Its approximate position as percentages (x: 0-100 left-to-right, y: 0-100 top-to-bottom)
3. Its approximate size as percentages (width, height)

Also note:
- Are there any computers/terminals visible? If so, describe them.
- Are there any doors visible? If so, where?
- Are there any phones visible? If so, where?
- Are there any windows visible? If so, where?
- What furniture is visible?
- What is on the walls?
- What is on the floor?

Be thorough and precise. This is a visual audit — every detail matters.

Return a JSON object with this format:
{
  "room_description": "Brief overall description of the scene",
  "visible_elements": [
    {"name": "...", "x": 50, "y": 30, "width": 10, "height": 15, "notes": "..."}
  ],
  "computers_terminals": [],
  "doors": [],
  "phones": [],
  "windows": [],
  "furniture": [],
  "wall_items": [],
  "floor_items": []
}"""


def audit_room(room_id: str) -> dict:
    bg_path = NOIR_IMAGE_DIR / f"bg_{room_id}.png"
    if not bg_path.exists():
        print(f"[SKIP] {room_id}: {bg_path} not found")
        return {"room_id": room_id, "error": "Image not found"}

    b64 = base64.b64encode(bg_path.read_bytes()).decode("utf-8")

    raw = vision_query(PROMPT_TEMPLATE, b64, mime="image/png")
    if not raw:
        return {"room_id": room_id, "error": "Failed after retries"}

    json_start = raw.find("{")
    json_end = raw.rfind("}") + 1
    if json_start == -1:
        print(f" [!] No JSON in response for {room_id}", file=sys.stderr)
        return {"room_id": room_id, "raw_response": raw}

    parsed = json.loads(raw[json_start:json_end])
    parsed["room_id"] = room_id
    return parsed


def main():
    force_ipv4()

    results = {}

    for room_id in ROOMS:
        print(f"\n[AUDIT] {room_id}")
        result = audit_room(room_id)
        results[room_id] = result

        desc = result.get("room_description", "N/A")
        elements = len(result.get("visible_elements", []))
        print(f" Description: {desc[:100]}...")
        print(f" Visible elements: {elements}")

        time.sleep(3)

    output_path = NOIR_IMAGE_DIR.parent.parent.parent.parent / "audit_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"Audit complete. Results saved to: {output_path}")
    print(f"Rooms audited: {len(results)}/8")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
