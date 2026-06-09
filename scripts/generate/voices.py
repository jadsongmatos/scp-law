#!/usr/bin/env python3
"""Build-time voice generation using s2.cpp HTTP server (Fish Audio S2-Pro).
Reads game_data.json, extracts all terminal_read and phone_call documentData,
generates WAV via s2.cpp server POST /generate, converts to MP3 via ffmpeg
into public/voice/{id}.mp3
Skips files that already exist (use --force to regenerate all).
"""

import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package required. pip install requests")
    sys.exit(1)

project_root = Path(__file__).resolve().parents[2]

if __package__ in (None, ""):
    project_root_str = str(project_root)
    if project_root_str not in sys.path:
        sys.path.insert(0, project_root_str)

from scripts.shared.config import (
    GAME_DATA_PATH,
    VOICE_DIR,
)

S2_DIR = project_root / "s2.cpp"
S2_BIN = S2_DIR / "tmp" / "s2"
S2_LIB = S2_DIR / "tmp"
S2_MODELS = project_root / "s2-models"
S2_TRANSFORMER = S2_MODELS / "s2-pro-q4_k_m-transformer-only.gguf"
S2_CODEC = S2_MODELS / "s2-pro-q4_k_m-codec-only.gguf"
S2_TOKENIZER = S2_DIR / "tokenizer.json"
S2_OUTPUT_DIR = project_root / "s2-output"
S2_SERVER_PORT = 9877
S2_SERVER_URL = f"http://127.0.0.1:{S2_SERVER_PORT}"

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
    text = '\n'.join(cleaned)
    if len(text) > 60:
        text = text[:57] + "..."
    return text


def start_s2_server() -> subprocess.Popen:
    env = os.environ.copy()
    env["LD_LIBRARY_PATH"] = str(S2_LIB)

    cmd = [
        str(S2_BIN),
        "--model", str(S2_TRANSFORMER),
        "--codec-model", str(S2_CODEC),
        "--tokenizer", str(S2_TOKENIZER),
        "-v", "0",
        "--codec-cpu",
        "--server",
        "--host", "127.0.0.1",
        "--port", str(S2_SERVER_PORT),
    ]

    log_path = S2_OUTPUT_DIR / "s2_server.log"
    log_f = open(log_path, "w")
    proc = subprocess.Popen(cmd, env=env, stdout=log_f, stderr=log_f)

    print(f"  Starting s2 server (PID {proc.pid}) on port {S2_SERVER_PORT}...")

    import socket
    for i in range(90):
        time.sleep(1)
        if proc.poll() is not None:
            raise RuntimeError(f"s2 server exited with code {proc.returncode}")
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(1)
        try:
            sock.connect(("127.0.0.1", S2_SERVER_PORT))
            sock.close()
            print(f"  Server listening after {i+1}s")
            break
        except (ConnectionRefusedError, socket.timeout, OSError):
            sock.close()
    else:
        raise RuntimeError("s2 server port not open within 90s")

    print("  Waiting for server to finish init (10s)...")
    time.sleep(10)
    print("  Server ready")
    return proc


def stop_s2_server(proc: subprocess.Popen):
    if proc.poll() is not None:
        return
    try:
        proc.terminate()
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)


def generate_voice_server(text: str, wav_path: str, mp3_path: str):
    while True:
        try:
            r = requests.post(
                f"{S2_SERVER_URL}/generate",
                files={"text": ("", text)},
                timeout=3600,
            )
        except requests.exceptions.ConnectionError:
            time.sleep(30)
            continue

        if r.status_code == 503:
            time.sleep(30)
            continue
        if r.status_code != 200:
            raise RuntimeError(f"Server returned {r.status_code}: {r.text[:200]}")

        try:
            wav_tmp = wav_path + ".tmp.wav"
            with open(wav_tmp, "wb") as f:
                f.write(r.content)

            if os.path.getsize(wav_tmp) == 0:
                os.remove(wav_tmp)
                raise RuntimeError("Server returned empty WAV")

            shutil.move(wav_tmp, wav_path)

            ffmpeg_cmd = [
                "ffmpeg", "-y", "-i", wav_path,
                "-codec:a", "libmp3lame", "-b:a", "128k",
                "-ar", "44100", "-ac", "1",
                mp3_path,
            ]
            ff = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=60)
            if ff.returncode != 0:
                raise RuntimeError(f"ffmpeg failed: {ff.stderr[-300:]}")

            return

        except RuntimeError:
            for p in (wav_path + ".tmp.wav", wav_path):
                if os.path.exists(p):
                    os.remove(p)
            raise


def main():
    force = "--force" in sys.argv

    os.makedirs(VOICE_DIR, exist_ok=True)
    os.makedirs(S2_OUTPUT_DIR, exist_ok=True)

    if not S2_BIN.exists():
        print(f"ERROR: s2 binary not found at {S2_BIN}")
        sys.exit(1)
    if not S2_TRANSFORMER.exists():
        print(f"ERROR: transformer model not found at {S2_TRANSFORMER}")
        sys.exit(1)
    if not S2_CODEC.exists():
        print(f"ERROR: codec model not found at {S2_CODEC}")
        sys.exit(1)

    with open(GAME_DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    tasks = []

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

            wav_path = str(S2_OUTPUT_DIR / f"{obj_id}.wav")
            mp3_path = str(VOICE_DIR / f"{obj_id}.mp3")

            if not force and os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
                print(f" SKIP {obj_id}: already exists")
                continue

            tasks.append((obj_id, speech_text, wav_path, mp3_path, obj.get("label", "")))

    if not tasks:
        print("All voice files already exist. Use --force to regenerate.")
        return

    print(f"Generating {len(tasks)} voice files via s2.cpp server...")
    print(f"  Transformer: {S2_TRANSFORMER.name}")
    print(f"  Codec:       {S2_CODEC.name} (CPU)")
    print()

    server_proc = None
    ok_count = 0
    err_count = 0

    try:
        server_proc = start_s2_server()

        for i, (obj_id, speech_text, wav_path, mp3_path, label) in enumerate(tasks, 1):
            print(f"  [{i}/{len(tasks)}] {obj_id} — {label[:50]}", flush=True)
            t0 = time.time()
            try:
                generate_voice_server(speech_text, wav_path, mp3_path)
                elapsed = time.time() - t0
                mp3_size = os.path.getsize(mp3_path) // 1024
                print(f"    OK  {elapsed:.0f}s  mp3={mp3_size}KB", flush=True)
                ok_count += 1
            except Exception as e:
                elapsed = time.time() - t0
                print(f"    ERROR ({elapsed:.0f}s): {e}", flush=True)
                err_count += 1

    finally:
        if server_proc:
            print("\n  Stopping s2 server...")
            stop_s2_server(server_proc)

    print(f"\nDone. {ok_count} generated, {err_count} errors, {len(tasks)} total")
    print(f"Output: {VOICE_DIR}/")


if __name__ == "__main__":
    main()
