#!/usr/bin/env python3
"""
Quick audit of 4 regenerated backgrounds to verify P1 sign fixes.
Uses Gemini 2.5-flash vision via OpenRouter.
"""

import requests
import base64
import json
import socket
import os
from pathlib import Path

socket.setdefaultsource = lambda: socket.AF_INET

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "google/gemini-2.5-flash"
API_URL = "https://openrouter.ai/api/v1/chat/completions"
IMG_DIR = Path("src/assets/images/noir")

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

AUDITS = {
    "rua_chuva": "Check this image for any visible text/signs. Specifically verify: (1) Is there a 'GASTHOF' neon sign (NOT 'BAR VILA NOVA')? (2) Is there a 'PFANDHAUS' sign (NOT 'LOJA DE PENHORES')? (3) List ALL visible text/signs in the image. (4) Are there any English words visible that should be German/Portuguese?",
    "bar": "Check this image for any visible text/signs. Specifically verify: (1) Is there a 'GASTHOF' neon sign behind the bar (NOT 'BAR VILA NOVA')? (2) Is there an 'OFFEN' sign (NOT 'OPEN')? (3) List ALL visible text/signs in the image. (4) Are there any English words visible?",
    "escola": "Check this image for any visible text/signs. Specifically verify: (1) Is there a 'DIRETORIA' sign on a door (NOT 'PRINCIPAL')? (2) Is the exit sign 'AUSGANG' (NOT 'EXIT')? (3) List ALL visible text/signs in the image. (4) Are there any English words visible?",
    "delegacia": "Check this image for any visible text/signs. Specifically verify: (1) Is there a 'VERNHAMMUNG' sign on a door (NOT 'INTERROGATION')? (2) Is there a 'VERMISSTE PERSONEN' board (NOT 'MISSING PERSONS')? (3) List ALL visible text/signs in the image. (4) Are there any English words visible?",
}


def audit_image(room, question):
    img_path = IMG_DIR / f"bg_{room}.png"
    if not img_path.exists():
        print(f"  MISSING: {img_path}")
        return

    img_b64 = base64.b64encode(img_path.read_bytes()).decode("utf-8")

    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": question},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}},
        ],
    }]

    payload = {
        "model": MODEL,
        "messages": messages,
    }

    for attempt in range(3):
        try:
            resp = requests.post(API_URL, headers=HEADERS, json=payload, timeout=60)
            resp.raise_for_status()
            result = resp.json()
            text = result["choices"][0]["message"]["content"]
            print(f"\n--- {room} ---")
            print(text)
            return
        except Exception as e:
            print(f"  Error (attempt {attempt+1}): {e}")
            import time; time.sleep(5)

    print(f"  FAILED to audit {room}")


def main():
    for room, question in AUDITS.items():
        audit_image(room, question)
        import time; time.sleep(2)

    print("\n\nAudit complete. Check results above for any remaining English text.")


if __name__ == "__main__":
    main()
