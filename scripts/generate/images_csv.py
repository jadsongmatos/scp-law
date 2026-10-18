#!/usr/bin/env python3
"""
Geracao de imagens via 9Router a partir de um CSV.

CSV (sem header, 2 colunas):
    prompt, output_path

Exemplo:
    "Dark alley at night, heavy rain. Brick walls.",src/assets/images/noir/bg_beco.png
    "Rusty industrial key on dark ground.",src/assets/images/noir/items/item_chave_armazem.png

Uso:
    python3 scripts/generate/images_csv.py images.csv
    python3 scripts/generate/images_csv.py --model ag/gemini-3.1-flash-image --size 1024x1024 images.csv
"""
import argparse
import base64
import csv
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from scripts.shared.ninerouter import generate_image, DEFAULT_MODEL


def run_csv(csv_path: str, model: str, size: str, delay: int):
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                print(f"  WARN: linha ignorada (menos de 2 colunas): {row}")
                continue
            prompt = row[0].strip()
            output = row[1].strip()
            if not prompt or not output:
                continue
            rows.append((prompt, output))

    total = len(rows)
    ok = 0
    fail = 0

    print("=" * 60)
    print(f"CSV: {csv_path} — {total} imagens para gerar")
    print(f"Model: {model}  Size: {size}")
    print("=" * 60)

    for i, (prompt, output) in enumerate(rows, 1):
        out_path = Path(output)
        print(f"\n[{i}/{total}] {out_path.name}")
        img_b64 = generate_image(prompt, model=model, size=size)
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
    parser = argparse.ArgumentParser(description="Gera imagens via 9Router a partir de CSV")
    parser.add_argument("csv", help="Caminho do CSV (prompt, output_path)")
    parser.add_argument("--model", default=None, help="Modelo 9Router (default: ag/gemini-3.1-flash-image)")
    parser.add_argument("--size", default="1024x1024", help="Tamanho da imagem (default: 1024x1024)")
    parser.add_argument("--delay", type=int, default=3, help="Segundos entre geracoes (default: 3)")
    args = parser.parse_args()

    model = args.model or DEFAULT_MODEL
    run_csv(args.csv, model, args.size, args.delay)


if __name__ == "__main__":
    main()
