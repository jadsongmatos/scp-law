#!/usr/bin/env python3
"""
Edicao de imagens via 9Router a partir de um CSV (usa /v1/chat/completions com reference image).

CSV (sem header, 3 colunas):
    reference_image, prompt, output_path

Exemplo:
    src/assets/images/noir/bg_beco.png,"Top-down mini-map view of this alley. Stylized floor plan, dark background, green outlines.",src/assets/images/noir/maps/map_beco.png

Uso:
    python3 scripts/generate/images_edit_csv.py edits.csv
    python3 scripts/generate/images_edit_csv.py --model ag/gemini-3.1-flash-image edits.csv
"""
import argparse
import base64
import csv
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from scripts.shared.ninerouter import edit_image, DEFAULT_MODEL


def run_csv(csv_path: str, model: str, delay: int):
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 3:
                print(f"  WARN: linha ignorada (menos de 3 colunas): {row}")
                continue
            ref_img = row[0].strip()
            prompt = row[1].strip()
            output = row[2].strip()
            if not ref_img or not prompt or not output:
                continue
            rows.append((ref_img, prompt, output))

    total = len(rows)
    ok = 0
    fail = 0

    print("=" * 60)
    print(f"CSV: {csv_path} — {total} imagens para editar")
    print(f"Model: {model}")
    print("=" * 60)

    for i, (ref_img, prompt, output) in enumerate(rows, 1):
        ref_path = Path(ref_img)
        out_path = Path(output)

        if not ref_path.exists():
            print(f"\n[{i}/{total}] {out_path.name}")
            print(f"  FALHA: referencia nao encontrada: {ref_path}")
            fail += 1
            continue

        print(f"\n[{i}/{total}] {out_path.name}")
        print(f"  ref: {ref_path.name} ({ref_path.stat().st_size // 1024} KB)")

        ref_b64 = base64.b64encode(ref_path.read_bytes()).decode()
        img_b64 = edit_image(prompt, reference_image_b64=ref_b64, model=model)
        if img_b64:
            img_bytes = base64.b64decode(img_b64)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(img_bytes)
            print(f"  OK ({len(img_bytes) // 1024} KB) → {out_path}")
            ok += 1
        else:
            print(f"  FALHA")
            fail += 1

        if i < total and delay > 0:
            time.sleep(delay)

    print("\n" + "=" * 60)
    print(f"Concluido: {ok} OK, {fail} FALHA, {total} total")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Edita imagens via 9Router (chat completions + reference) a partir de CSV")
    parser.add_argument("csv", help="Caminho do CSV (reference_image, prompt, output_path)")
    parser.add_argument("--model", default=None, help="Modelo 9Router (default: ag/gemini-3.1-flash-image)")
    parser.add_argument("--delay", type=int, default=3, help="Segundos entre edicoes (default: 3)")
    args = parser.parse_args()

    model = args.model or DEFAULT_MODEL
    run_csv(args.csv, model, args.delay)


if __name__ == "__main__":
    main()
