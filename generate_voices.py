#!/usr/bin/env python3
"""Build-time voice generation using edge-tts.
Reads game_data.json, extracts all terminal_read documentData content,
generates MP3 files into public/voice/{id}.mp3
"""

import asyncio
import json
import os
import re
import sys

try:
    import edge_tts
except ImportError:
    print("edge-tts not installed. Run: pip install edge-tts")
    sys.exit(1)

GAME_DATA_PATH = os.path.join(os.path.dirname(__file__), "src", "game_data.json")
VOICE_DIR = os.path.join(os.path.dirname(__file__), "public", "voice")

MALE_VOICE = "pt-BR-AntonioNeural"
FEMALE_VOICE = "pt-BR-FranciscaNeural"
GERMAN_MALE_VOICE = "de-DE-KillianNeural"

CHARACTER_VOICES = {
    "telefone_zeca": MALE_VOICE,
    "telefone_diretora": FEMALE_VOICE,
    "telefone_santos": MALE_VOICE,
    "carta_jonas": MALE_VOICE,
    "ficheiro_helena": MALE_VOICE,
    "bilhete_anonimo": GERMAN_MALE_VOICE,
    "terminal_fosforo": MALE_VOICE,
    "terminal_final": MALE_VOICE,
    "arquivo_mendes": MALE_VOICE,
    "puzzle_deduction_terminal": MALE_VOICE,
    "puzzle_solution_terminal": MALE_VOICE,
}

DECORATION_RE = re.compile(r'[═─━┃┆┊│┤├┬┴┼╗╝╚╔║╗╝╠╣╦╩╬\*]+')
BIP_RE = re.compile(r'\*BIP\*')
STATIC_RE = re.compile(r'\*estática\*')
CLICK_RE = re.compile(r'\*clic\*')
SEPARATOR_RE = re.compile(r'^[-=]{3,}$')


def clean_content_for_speech(content_lines: list[str]) -> str:
    """Clean document content lines into natural speech text."""
    cleaned = []
    for line in content_lines:
        line = line.strip()
        if not line:
            continue
        if SEPARATOR_RE.match(line):
            continue
        if DECORATION_RE.match(line):
            continue
        line = DECORATION_RE.sub('', line)
        line = BIP_RE.sub('bip', line)
        line = STATIC_RE.sub('... estática ...', line)
        line = CLICK_RE.sub('... clique ...', line)
        line = line.strip()
        if not line:
            continue
        if line.startswith('//'):
            line = line[2:].strip()
        if line.startswith('>'):
            line = line[1:].strip()
        cleaned.append(line)
    return '\n'.join(cleaned)


async def generate_voice(text: str, voice: str, output_path: str, retries: int = 3):
    """Generate a single voice MP3 using edge-tts with retry."""
    for attempt in range(retries):
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(output_path)
            if os.path.getsize(output_path) > 0:
                return
            os.remove(output_path)
        except Exception as e:
            if os.path.exists(output_path):
                os.remove(output_path)
            if attempt < retries - 1:
                await asyncio.sleep(2 * (attempt + 1))
                continue
            raise


async def main():
    os.makedirs(VOICE_DIR, exist_ok=True)

    with open(GAME_DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    tasks = []
    metadata = {}

    for room_id, room in data["GAME_ROOMS"].items():
        for obj in room.get("interactables", []):
            if obj.get("type") != "terminal_read":
                continue
            if not obj.get("documentData"):
                continue

            obj_id = obj["id"]
            content = obj["documentData"].get("content", [])
            speech_text = clean_content_for_speech(content)

            if not speech_text.strip():
                print(f"  SKIP {obj_id}: no speakable content")
                continue

            voice = CHARACTER_VOICES.get(obj_id, MALE_VOICE)
            output_path = os.path.join(VOICE_DIR, f"{obj_id}.mp3")

            metadata[obj_id] = {
                "voice": voice,
                "text_length": len(speech_text),
                "label": obj.get("label", ""),
                "room": room_id,
            }

            tasks.append((obj_id, speech_text, voice, output_path))

    print(f"Generating {len(tasks)} voice files...")

    for obj_id, speech_text, voice, output_path in tasks:
        print(f"  {obj_id} ({voice}) -> {os.path.basename(output_path)}")
        try:
            await generate_voice(speech_text, voice, output_path)
        except Exception as e:
            print(f"  ERROR {obj_id}: {e}")

    meta_path = os.path.join(VOICE_DIR, "_metadata.json")
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print(f"\nDone. {len(tasks)} files in {VOICE_DIR}/")
    print(f"Metadata: {meta_path}")


if __name__ == "__main__":
    asyncio.run(main())
