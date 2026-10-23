#!/usr/bin/env python3
"""Build-time voice generation using s2.cpp (Fish Audio S2-Pro GGUF).
Reads game_data.json, extracts all terminal_read and phone_call documentData,
generates WAV via s2.cpp, converts to MP3 into public/voice/{id}.mp3
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from tqdm import tqdm
except ImportError:
    tqdm = None

if __package__ in (None, ""):
    project_root = Path(__file__).resolve().parents[2]
    project_root_str = str(project_root)
    if project_root_str not in sys.path:
        sys.path.insert(0, project_root_str)

from scripts.shared.config import (
    GAME_DATA_PATH,
    VOICE_DIR,
    S2_BINARY,
    S2_MODEL,
    S2_CODEC_MODEL,
    S2_TOKENIZER,
    S2_LIB_PATH,
)

DONE_PATH = VOICE_DIR / "_done.json"

DECORATION_RE = re.compile(r'[═─━┃┆┊│┤├┬┴┼╗╝╚╔║╗╝╠╣╦╩╬\*]+')
BIP_RE = re.compile(r'\*BIP\*')
STATIC_RE = re.compile(r'\*estática\*')
CLICK_RE = re.compile(r'\*clic\*')
SEPARATOR_RE = re.compile(r'^[-=]{3,}$')


def clean_content_for_speech(content_lines: list[str]) -> str:
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


def generate_with_s2(text: str, output_wav: str) -> bool:
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = f"{S2_LIB_PATH}:{env.get('LD_LIBRARY_PATH', '')}"

    cmd = [
        str(S2_BINARY),
        "--model", str(S2_MODEL),
        "--tokenizer", str(S2_TOKENIZER),
        "--codec-model", str(S2_CODEC_MODEL),
        "-v", "0",
        "--codec-cpu",
        "--text", text,
        "--output", output_wav,
        "--log-level", "info",
    ]

    # Decode do codec roda na CPU (--codec-cpu): medido em ~3,6 s/frame
    # nesta máquina (RTX 3050, RTF ~80x) — um documento de ~500 chars
    # leva 40-50 min. --codec-auto e --codec-follow-backend não migram
    # o codec para a GPU Vulkan (teste 23/10/2026).
    result = subprocess.run(
        cmd,
        env=env,
        capture_output=True,
        text=True,
        timeout=5400,
    )

    if result.returncode != 0:
        print(f"  s2 error: {result.stderr.strip()}")
        return False

    if not os.path.exists(output_wav) or os.path.getsize(output_wav) == 0:
        print(f"  s2 produced empty output")
        return False

    return True


def convert_wav_to_mp3(wav_path: str, mp3_path: str) -> bool:
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", wav_path,
         "-codec:a", "libmp3lame", "-qscale:a", "2",
         mp3_path],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  ffmpeg error: {result.stderr.strip()}")
        return False
    return os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0


def generate_voice(text: str, output_mp3: str) -> bool:
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        wav_path = f.name
    try:
        if not generate_with_s2(text, wav_path):
            return False
        if not convert_wav_to_mp3(wav_path, output_mp3):
            return False
        return True
    finally:
        if os.path.exists(wav_path):
            os.unlink(wav_path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--force', action='store_true', help='Ignore checkpoint and regenerate all')
    args = parser.parse_args()

    os.makedirs(VOICE_DIR, exist_ok=True)

    # Load checkpoint
    done_ids = set()
    if not args.force and DONE_PATH.exists():
        try:
            with open(DONE_PATH, 'r', encoding='utf-8') as f:
                done_ids = set(json.load(f))
        except Exception:
            pass

    with open(GAME_DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    tasks = []
    metadata = {}

    for room_id, room in data["GAME_ROOMS"].items():
        for obj in room.get("interactables", []):
            if obj.get("type") not in ("terminal_read", "phone_call"):
                continue
            if not obj.get("documentData"):
                continue

            obj_id = obj["id"]
            content = obj["documentData"].get("content", [])
            speech_text = clean_content_for_speech(content)

            if not speech_text.strip():
                print(f" SKIP {obj_id}: no speakable content")
                continue

            if obj_id in done_ids:
                print(f" SKIP {obj_id}: already done (checkpoint)")
                # Still add to metadata for completeness
                metadata[obj_id] = {
                    "voice": "s2-pro",
                    "text_length": len(speech_text),
                    "label": obj.get("label", ""),
                    "room": room_id,
                }
                continue

            output_path = str(VOICE_DIR / f"{obj_id}.mp3")

            metadata[obj_id] = {
                "voice": "s2-pro",
                "text_length": len(speech_text),
                "label": obj.get("label", ""),
                "room": room_id,
            }

            tasks.append((obj_id, speech_text, output_path))

    if not tasks:
        print("No voice tasks found.")
        return

    print(f"Generating {len(tasks)} voice files with s2.cpp...")
    print()

    iterator = tasks
    if tqdm:
        iterator = tqdm(tasks, desc="Voices", unit="file", ncols=80)

    for i, (obj_id, speech_text, output_path) in enumerate(iterator, 1):
        if not tqdm:
            print(f"[{i}/{len(tasks)}] {obj_id} -> {os.path.basename(output_path)}")
        try:
            ok = generate_voice(speech_text, output_path)
            if ok:
                print(f"  OK ({os.path.getsize(output_path)} bytes)")
                done_ids.add(obj_id)
                # Update checkpoint after each success
                with open(DONE_PATH, 'w', encoding='utf-8') as f:
                    json.dump(sorted(done_ids), f)
            else:
                print(f"  FAILED")
        except subprocess.TimeoutExpired:
            print(f"  TIMEOUT (600s)")
        except Exception as e:
            print(f"  ERROR: {e}")

    meta_path = str(VOICE_DIR / "_metadata.json")
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print(f"\nDone. Metadata: {meta_path}")


if __name__ == "__main__":
    main()
