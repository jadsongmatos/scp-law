#!/usr/bin/env python3
import os
import socket
import urllib3.util.connection as conn
conn.allowed_gai_family = lambda: socket.AF_INET

import base64
import json
import sys
import time
from pathlib import Path

import requests

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "google/gemini-2.5-flash"
API_URL = "https://openrouter.ai/api/v1/chat/completions"

BG_DIR = Path("src/assets/images/noir")

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

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

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


def encode_image(image_path: Path) -> str:
    return base64.b64encode(image_path.read_bytes()).decode("utf-8")


def audit_room(room_id: str, image_path: Path) -> dict:
    b64 = encode_image(image_path)
    mime = "image/png"

    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                    {"type": "text", "text": PROMPT_TEMPLATE},
                ],
            }
        ],
        "temperature": 0.2,
        "max_tokens": 4096,
    }

    for attempt in range(3):
        try:
            resp = requests.post(API_URL, headers=HEADERS, json=payload, timeout=120)
            resp.raise_for_status()
            result = resp.json()

            content = result["choices"][0]["message"]["content"]
            json_start = content.find("{")
            json_end = content.rfind("}") + 1
            if json_start == -1:
                print(f"  [!] No JSON in response for {room_id}", file=sys.stderr)
                return {"room_id": room_id, "raw_response": content}

            parsed = json.loads(content[json_start:json_end])
            parsed["room_id"] = room_id
            return parsed

        except Exception as e:
            print(f"  [!] Error (attempt {attempt+1}): {e}", file=sys.stderr)
            if attempt < 2:
                time.sleep(10 * (attempt + 1))

    return {"room_id": room_id, "error": "Failed after 3 attempts"}


def main():
    results = {}

    for room_id in ROOMS:
        bg_path = BG_DIR / f"bg_{room_id}.png"
        if not bg_path.exists():
            print(f"[SKIP] {room_id}: {bg_path} not found")
            continue

        print(f"\n[AUDIT] {room_id} — {bg_path}")
        result = audit_room(room_id, bg_path)
        results[room_id] = result

        desc = result.get("room_description", "N/A")
        elements = len(result.get("visible_elements", []))
        print(f"  Description: {desc[:100]}...")
        print(f"  Visible elements: {elements}")

        time.sleep(3)

    output_path = Path("audit_results.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"Audit complete. Results saved to: {output_path}")
    print(f"Rooms audited: {len(results)}/8")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
