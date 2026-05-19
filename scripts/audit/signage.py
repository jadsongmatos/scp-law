#!/usr/bin/env python3
"""
Quick audit of regenerated backgrounds to verify sign/text fixes.
Uses Gemini 2.5-flash vision via OpenRouter.
"""

import base64
import time

from scripts.shared.config import NOIR_IMAGE_DIR, VISION_MODEL
from scripts.shared.openrouter import vision_query
from scripts.shared.ipv4_fix import force_ipv4

AUDITS = {
    "rua_chuva": "Check this image for any visible text/signs. Specifically verify: (1) Is there a 'GASTHOF' neon sign (NOT 'BAR VILA NOVA')? (2) Is there a 'PFANDHAUS' sign (NOT 'LOJA DE PENHORES')? (3) List ALL visible text/signs in the image. (4) Are there any English words visible that should be German/Portuguese?",
    "bar": "Check this image for any visible text/signs. Specifically verify: (1) Is there a 'GASTHOF' neon sign behind the bar (NOT 'BAR VILA NOVA')? (2) Is there an 'OFFEN' sign (NOT 'OPEN')? (3) List ALL visible text/signs in the image. (4) Are there any English words visible?",
    "escola": "Check this image for any visible text/signs. Specifically verify: (1) Is there a 'DIRETORIA' sign on a door (NOT 'PRINCIPAL')? (2) Is the exit sign 'AUSGANG' (NOT 'EXIT')? (3) List ALL visible text/signs in the image. (4) Are there any English words visible?",
    "delegacia": "Check this image for any visible text/signs. Specifically verify: (1) Is there a 'VERNHAMMUNG' sign on a door (NOT 'INTERROGATION')? (2) Is there a 'VERMISSTE PERSONEN' board (NOT 'MISSING PERSONS')? (3) List ALL visible text/signs in the image. (4) Are there any English words visible?",
}


def audit_image(room: str, question: str) -> None:
    img_path = NOIR_IMAGE_DIR / f"bg_{room}.png"
    if not img_path.exists():
        print(f" MISSING: {img_path}")
        return

    img_b64 = base64.b64encode(img_path.read_bytes()).decode("utf-8")

    text = vision_query(question, img_b64, mime="image/png")
    print(f"\n--- {room} ---")
    if text:
        print(text)
    else:
        print(" FAILED to get response")


def main():
    force_ipv4()

    for room, question in AUDITS.items():
        audit_image(room, question)
        time.sleep(2)

    print("\n\nAudit complete. Check results above for any remaining English text.")


if __name__ == "__main__":
    main()
