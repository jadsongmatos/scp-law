#!/usr/bin/env python3
"""
Geracao/edicao via NVIDIA flux.1-kontext-dev (9router-style).

CSV (4 colunas, sem header):
    reference_image, prompt, output_path, aspect_ratio
    - reference_image: caminho do PNG de referencia (vazio = text-to-image)
    - prompt: descricao
    - output_path: caminho do PNG de saida
    - aspect_ratio: '21:9' (16:9 cinematic), '1:1' (maps/itens), 'match_input_image'

Uso:
    python3 scripts/generate/nvidia_gen.py gen_list.csv
"""
import argparse
import base64
import csv
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from scripts.shared.nvidia_flux import generate_or_edit


def run_csv(csv_path: str, delay: int):
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 3:
                continue
            ref = row[0].strip() or None
            prompt = row[1].strip()
            output = row[2].strip()
            ar = row[3].strip() if len(row) > 3 else "match_input_image"
            if not prompt or not output:
                continue
            rows.append((ref, prompt, output, ar))

    total = len(rows)
    ok, fail = 0, 0
    print("=" * 60)
    print(f"NVIDIA flux.1-kontext-dev — {total} imagens")
    print("=" * 60)

    for i, (ref, prompt, output, ar) in enumerate(rows, 1):
        ref_path = Path(ref) if ref else None
        out_path = Path(output)
        print(f"\n[{i}/{total}] {out_path.name} (ar={ar})")
        img_b64 = generate_or_edit(prompt, image_path=ref_path, aspect_ratio=ar)
        if img_b64:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(base64.b64decode(img_b64))
            print(f"  OK → {out_path}")
            ok += 1
        else:
            print(f"  FALHA")
            fail += 1
        if i < total and delay > 0:
            time.sleep(delay)

    print("\n" + "=" * 60)
    print(f"Concluido: {ok} OK, {fail} FALHA")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("csv")
    parser.add_argument("--delay", type=int, default=3)
    args = parser.parse_args()
    run_csv(args.csv, args.delay)
