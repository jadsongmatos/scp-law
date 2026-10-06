#!/usr/bin/env python3
"""
extract_positions.py
Pipeline DINOv2-large + Gemma-4-31b-it (via OpenRouter) para extrair posições de itens
nas imagens de cenário do jogo SCP.

Fluxo:
1. DINOv2-large extrai patch embeddings (denso) por região da imagem
2. DBSCAN clusteriza patches por similaridade → regiões semânticas
3. Gemma-4-31b-it recebe a imagem + regiões DINOv2 e classifica/refina
   cada item no contexto do jogo SCP (portas, terminais, keycards, etc.)
4. Gera interactables no formato do game_data.json

Modos:
  --mode patches   Extração de patch embeddings + clustering (padrão)
  --mode cls       Apenas CLS token (para auditoria de similaridade entre salas)
  --mode full      patches + classificação Gemma

Uso:
  python3 -m scripts.vision.extract_positions src/assets/images/noir/*.png --mode full
  python3 -m scripts.vision.extract_positions src/assets/images/noir/*.png --mode cls
  python3 -m scripts.vision.extract_positions src/assets/images/noir/*.png --mode patches --dry-run

Dependências:
  pip install torch transformers Pillow scikit-learn requests

Env:
  OPENROUTER_API_KEY - Para classificação Gemma (obrigatório se --mode full)
"""

import argparse
import base64
import json
import os
import sys
from io import BytesIO
from pathlib import Path

import numpy as np
import requests
from PIL import Image

try:
    import torch
    from transformers import AutoImageProcessor, AutoModel
except ImportError:
    print("ERRO: torch/transformers não instalados. Execute: pip install torch transformers", file=sys.stderr)
    sys.exit(1)

try:
    from sklearn.cluster import DBSCAN
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    print("ERRO: scikit-learn não instalado. Execute: pip install scikit-learn", file=sys.stderr)
    sys.exit(1)

from scripts.shared.config import (
    OPENROUTER_API_URL, OPENROUTER_API_KEY, GEMMA_MODEL, NOIR_IMAGE_DIR, PROJECT_ROOT,
)

DINOV2_MODEL_ID = "facebook/dinov2-large"
DBSCAN_EPS = 0.5
MIN_CLUSTER_SAMPLES = 6
MIN_CLUSTER_AREA_PCT = 1.5
MAX_CLUSTERS = 20

KNOWN_ROOMS = {
    "rua_chuva": "Rua sob a Chuva",
    "escritorio": "Escritório do Investigador",
    "escola": "Escola Municipal",
    "diretoria": "Diretoria da Escola",
    "delegacia": "Delegacia [Volkspolizei]",
    "beco": "Beco dos Fundos",
    "bar": "Bar Vila Nova",
    "armazem": "Armazém [Lagerhaus]",
}


def guess_room_id(image_path: str) -> str:
    name = Path(image_path).stem.lower().removeprefix("bg_")
    for room_key in KNOWN_ROOMS:
        if room_key in name:
            return room_key
    return "unknown_room"


def encode_image_base64(image_path: str, max_size: int = 1536) -> tuple[str, str]:
    img = Image.open(image_path)
    if max(img.size) > max_size:
        ratio = max_size / max(img.size)
        img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return b64, "image/jpeg"


# ---------------------------------------------------------------------------
# DINOv2 feature extraction
# ---------------------------------------------------------------------------

def load_dinov2(model_id: str = DINOV2_MODEL_ID, device: str | None = None):
    dev = device or ("cuda" if torch.cuda.is_available() else "cpu")
    processor = AutoImageProcessor.from_pretrained(model_id)
    model = AutoModel.from_pretrained(model_id)
    model = model.to(dev).eval()
    return processor, model, dev


def extract_features(
    image_path: str,
    processor,
    model,
    device: str,
) -> dict:
    image = Image.open(image_path).convert("RGB")
    inputs = processor(images=image, return_tensors="pt").to(device)

    with torch.no_grad():
        outputs = model(**inputs)

    patch_size = model.config.patch_size
    h_feat = inputs["pixel_values"].shape[2]
    w_feat = inputs["pixel_values"].shape[3]
    grid_h = h_feat // patch_size
    grid_w = w_feat // patch_size

    cls_embedding = outputs.last_hidden_state[:, 0, :].squeeze(0).cpu().numpy()
    patch_embeddings = outputs.last_hidden_state[:, 1:, :].squeeze(0).cpu().numpy()
    patch_grid = patch_embeddings.reshape(grid_h, grid_w, -1)

    return {
        "cls": cls_embedding,
        "patch_grid": patch_grid,
        "grid_size": (grid_h, grid_w),
        "patch_size": patch_size,
    }


# ---------------------------------------------------------------------------
# Patch clustering
# ---------------------------------------------------------------------------

def cluster_patches(
    patch_grid: np.ndarray,
    eps: float = DBSCAN_EPS,
    min_samples: int = MIN_CLUSTER_SAMPLES,
) -> np.ndarray:
    h, w, dim = patch_grid.shape
    flat = patch_grid.reshape(-1, dim)

    norms = np.linalg.norm(flat, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    flat_normed = flat / norms

    clustering = DBSCAN(eps=eps, min_samples=min_samples, metric="cosine").fit(flat_normed)
    labels = clustering.labels_.reshape(h, w)
    return labels


def clusters_to_regions(
    labels: np.ndarray,
    grid_size: tuple[int, int],
    image_size: tuple[int, int],
    min_area_pct: float = MIN_CLUSTER_AREA_PCT,
) -> list[dict]:
    grid_h, grid_w = grid_size
    cell_w_pct = 100.0 / grid_w
    cell_h_pct = 100.0 / grid_h

    unique_labels = set(labels.flat) - {-1}
    regions = []

    for lbl in unique_labels:
        mask = labels == lbl
        ys, xs = np.where(mask)
        if len(xs) == 0:
            continue

        x_pct = xs.min() * cell_w_pct
        y_pct = ys.min() * cell_h_pct
        w_pct = (xs.max() - xs.min() + 1) * cell_w_pct
        h_pct = (ys.max() - ys.min() + 1) * cell_h_pct

        area_pct = w_pct * h_pct
        if area_pct < min_area_pct:
            continue

        regions.append({
            "cluster_id": int(lbl),
            "x": round(x_pct + w_pct / 2, 1),
            "y": round(y_pct + h_pct / 2, 1),
            "width": round(w_pct, 1),
            "height": round(h_pct, 1),
            "area_pct": round(area_pct, 1),
            "patch_count": int(mask.sum()),
        })

    regions.sort(key=lambda r: r["area_pct"], reverse=True)
    return regions[:MAX_CLUSTERS]


# ---------------------------------------------------------------------------
# CLS similarity (scene audit mode)
# ---------------------------------------------------------------------------

def compute_cls_similarity(embeddings: dict[str, np.ndarray]) -> list[dict]:
    names = list(embeddings.keys())
    vectors = np.stack([embeddings[n] for n in names])
    sim_matrix = cosine_similarity(vectors)
    pairs = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            pairs.append({
                "scene_a": names[i],
                "scene_b": names[j],
                "similarity": round(float(sim_matrix[i, j]), 4),
            })
    pairs.sort(key=lambda p: p["similarity"])
    return pairs


# ---------------------------------------------------------------------------
# Gemma classification
# ---------------------------------------------------------------------------

def classify_with_gemma(
    image_path: str,
    regions: list[dict],
    room_id: str,
    api_key: str,
) -> list[dict]:
    b64_img, mime = encode_image_base64(image_path)
    regions_text = json.dumps(regions, indent=2, ensure_ascii=False)

    prompt = f"""Você é um analisador de cenários para um jogo de investigação noir (Murphy Law — Investigações Privadas).
Analise a imagem de cenário fornecida junto com as regiões detectadas pelo DINOv2 abaixo.

Sala atual: {room_id} — {KNOWN_ROOMS.get(room_id, 'Desconhecida')}

Regiões DINOv2 (clusters semânticos, coordenadas em porcentagem 0-100%):
{regions_text}

Para CADA região DINOv2, refine e classifique no contexto do jogo. Você deve:
1. Identificar o que a região representa no cenário noir (ex: cluster pode ser uma porta, um telefone, um arquivo, uma janela)
2. Atribuir um tipo de ação: "travel" (portas/passagens), "pickup" (itens coletáveis), "inspect" (objetos examináveis), "terminal_read" (terminais/documentos), "phone_call" (telefone/comunicação)
3. Atribuir um ícone lucide-react apropriado: DoorClosed, DoorOpen, Key, Search, FileText, Ghost, Skull, ShieldCheck, Archive, Lock, Terminal, Database, Eye, Flame, Monitor, Bug, Phone
4. Criar um label descritivo em português brasileiro
5. Criar uma description imersiva em português (tom noir/suspense, estética filme noir alemão)
6. Ajustar coordenadas se perceber que a região está mal posicionada

Regras:
- Portas que levam a outras salas devem ter type "travel" e targetRoom preenchido
- Itens coletáveis devem ter type "pickup", pickupItem e hideAfterInteract: true
- Terminais/documentos devem ter type "terminal_read" com documentData
- Telefones devem ter type "phone_call"
- Objetos decorativos devem ter type "inspect"
- Se a região DINOv2 for ruído de fundo (parede vazia, chão), exclua-a
- Se houver itens importantes no cenário que o DINOv2 NÃO detectou, adicione-os com coordenadas estimadas
- TODO texto deve ser em português brasileiro; termos alemães apenas para lore (GESCHLOSSEN, Lagerhaus, etc.)

Retorne APENAS um JSON no formato:
{{
  "interactables": [
    {{
      "id": "identificador_unico",
      "x": 50.0,
      "y": 30.0,
      "width": 10.0,
      "height": 15.0,
      "icon": "DoorClosed",
      "type": "travel",
      "label": "Porta do Escritório",
      "description": "Uma porta de madeira escura com fechadura antiga.",
      "targetRoom": "delegacia",
      "requiredItem": null,
      "failedMessage": null,
      "successMessage": null,
      "pickupItem": null,
      "hideAfterInteract": false,
      "documentData": null
    }}
  ]
}}"""

    payload = {
        "model": GEMMA_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64_img}"}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
        "temperature": 0.3,
        "max_tokens": 4096,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/scp_game",
        "X-Title": "SCP Game Position Extractor (DINOv2)",
    }

    resp = requests.post(OPENROUTER_API_URL, json=payload, headers=headers, timeout=120)
    if resp.status_code != 200:
        print(f" [!] Erro OpenRouter {resp.status_code}: {resp.text}", file=sys.stderr)
        return []

    raw = resp.json()["choices"][0]["message"]["content"]

    json_start = raw.find("{")
    json_end = raw.rfind("}") + 1
    if json_start == -1 or json_end == 0:
        print(f" [!] Gemma não retornou JSON válido. Resposta bruta:\n{raw}", file=sys.stderr)
        return []

    cleaned = raw[json_start:json_end]
    parsed = json.loads(cleaned)
    return parsed.get("interactables", [])


# ---------------------------------------------------------------------------
# Fallback: quick auto-mapping (no Gemma)
# ---------------------------------------------------------------------------

DEFAULT_ICON = "Search"
DEFAULT_TYPE = "inspect"

REGION_ICON_HEURISTICS = {
    "tall_narrow": {"icon": "DoorClosed", "type": "travel"},
    "small_center": {"icon": "Search", "type": "inspect"},
    "wide_top": {"icon": "Monitor", "type": "inspect"},
    "large_center": {"icon": "Search", "type": "inspect"},
}


def guess_region_style(region: dict) -> dict:
    w = region["width"]
    h = region["height"]
    aspect = h / w if w > 0 else 1
    area = region["area_pct"]

    if aspect > 2.0 and w < 15:
        return REGION_ICON_HEURISTICS["tall_narrow"]
    if area < 5 and 30 < region["x"] < 70 and 20 < region["y"] < 80:
        return REGION_ICON_HEURISTICS["small_center"]
    if aspect < 0.6 and region["y"] < 30:
        return REGION_ICON_HEURISTICS["wide_top"]
    return REGION_ICON_HEURISTICS["large_center"]


def quick_map_dinov2(regions: list[dict]) -> list[dict]:
    interactables = []
    for i, r in enumerate(regions):
        style = guess_region_style(r)
        interactables.append({
            "id": f"dinov2_region_{r['cluster_id']}_{i}",
            "x": r["x"],
            "y": r["y"],
            "width": r["width"],
            "height": r["height"],
            "icon": style["icon"],
            "type": style["type"],
            "label": f"Região {r['cluster_id']}",
            "description": f"[DINOv2 auto] Cluster {r['cluster_id']} — {r['patch_count']} patches, área {r['area_pct']}%",
            "dinov2_cluster": r["cluster_id"],
            "dinov2_area_pct": r["area_pct"],
        })
    return interactables


# ---------------------------------------------------------------------------
# Pipeline orchestration
# ---------------------------------------------------------------------------

def run_dinov2(
    image_path: str,
    processor,
    model,
    device: str,
    eps: float,
    min_samples: int,
) -> tuple[list[dict], dict]:
    feats = extract_features(image_path, processor, model, device)
    labels = cluster_patches(feats["patch_grid"], eps=eps, min_samples=min_samples)

    img = Image.open(image_path)
    regions = clusters_to_regions(labels, feats["grid_size"], img.size)

    meta = {
        "num_clusters": len(set(labels.flat) - {-1}),
        "grid_size": list(feats["grid_size"]),
        "cls_embedding_dim": feats["cls"].shape[0],
    }

    return regions, meta


def process_image_patches(
    image_path: str,
    processor,
    model,
    device: str,
    eps: float,
    min_samples: int,
) -> dict:
    regions, meta = run_dinov2(image_path, processor, model, device, eps, min_samples)
    return {
        "regions": regions,
        "interactables": quick_map_dinov2(regions),
        **meta,
    }


def process_image_full(
    image_path: str,
    room_id: str,
    processor,
    model,
    device: str,
    api_key: str | None,
    eps: float,
    min_samples: int,
    dry_run: bool,
) -> dict:
    regions, meta = run_dinov2(image_path, processor, model, device, eps, min_samples)

    if dry_run or not api_key:
        if not api_key and not dry_run:
            print("\n[!] OPENROUTER_API_KEY não definida. Usando mapeamento rápido DINOv2→game.")
        interactables = quick_map_dinov2(regions)
    else:
        print("\n[2/2] Classificando com Gemma-4-31b-it via OpenRouter...")
        interactables = classify_with_gemma(image_path, regions, room_id, api_key)
        print(f" {len(interactables)} interactables gerados pelo Gemma")

    for item in interactables:
        item.setdefault("width", 8)
        item.setdefault("height", 10)

    return {
        "regions": regions,
        **meta,
        "interactables": interactables,
    }


def process_image_cls(
    image_path: str,
    processor,
    model,
    device: str,
) -> tuple[str, np.ndarray]:
    feats = extract_features(image_path, processor, model, device)
    name = Path(image_path).stem
    return name, feats["cls"]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extrai posições de itens em imagens de cenário via DINOv2-large + Gemma-4-31b-it (OpenRouter)."
    )
    parser.add_argument("images", nargs="+", metavar="IMAGE",
                        help="Caminho(s) para imagem(ns) de cenário")
    parser.add_argument("--room", "-r", metavar="ROOM_ID",
                        help="ID da sala. Auto-detectado se omitido.")
    parser.add_argument("--mode", choices=["patches", "cls", "full"], default="full",
                        help="Modo: patches (clustering), cls (similaridade entre salas), full (patches+gemma)")
    parser.add_argument("--model-id", default=DINOV2_MODEL_ID, metavar="HF_MODEL",
                        help=f"Modelo DINOv2 (padrão: {DINOV2_MODEL_ID})")
    parser.add_argument("--eps", type=float, default=DBSCAN_EPS, metavar="FLOAT",
                        help=f"DBSCAN eps (padrão: {DBSCAN_EPS})")
    parser.add_argument("--min-samples", type=int, default=MIN_CLUSTER_SAMPLES, metavar="INT",
                        help=f"DBSCAN min_samples (padrão: {MIN_CLUSTER_SAMPLES})")
    parser.add_argument("--output", "-o", default=str(PROJECT_ROOT / "extracted_positions.json"),
                        metavar="FILE", help="Arquivo JSON de saída")
    parser.add_argument("--dry-run", action="store_true",
                        help="Apenas DINOv2 clustering, sem chamar a API do Gemma")
    args = parser.parse_args()

    api_key = os.environ.get("OPENROUTER_API_KEY")

    print(f"[DINOv2] Carregando modelo {args.model_id}...")
    processor, model, device = load_dinov2(args.model_id)
    print(f"[DINOv2] Modelo carregado no dispositivo: {device}")

    if args.mode == "cls":
        embeddings = {}
        for image_path in args.images:
            if not Path(image_path).exists():
                print(f"[!] Imagem não encontrada: {image_path}", file=sys.stderr)
                continue
            print(f"  Extraindo CLS embedding: {Path(image_path).stem}...")
            name, cls_vec = process_image_cls(image_path, processor, model, device)
            embeddings[name] = cls_vec

        pairs = compute_cls_similarity(embeddings)
        output = {
            "pipeline": f"DINOv2 CLS similarity ({args.model_id})",
            "mode": "cls",
            "embeddings": {k: v.tolist() for k, v in embeddings.items()},
            "similarity_pairs": pairs,
            "least_similar": pairs[:3],
            "most_similar": pairs[-3:],
        }
    else:
        all_rooms = {}
        for image_path in args.images:
            if not Path(image_path).exists():
                print(f"[!] Imagem não encontrada: {image_path}", file=sys.stderr)
                continue

            room_id = args.room or guess_room_id(image_path)
            print(f"\n{'='*60}")
            print(f"Processando: {image_path}")
            print(f"Sala: {room_id} — {KNOWN_ROOMS.get(room_id, 'Desconhecida')}")
            print(f"{'='*60}")

            print("\n[1/2] Executando DINOv2 + DBSCAN clustering...")
            result = process_image_full(
                image_path, room_id, processor, model, device,
                api_key=api_key, eps=args.eps, min_samples=args.min_samples,
                dry_run=args.dry_run,
            )

            all_rooms[room_id] = result
            print(f"  {result.get('num_clusters', 0)} clusters, {len(result.get('regions', []))} regiões, {len(result.get('interactables', []))} interactables")

        output = {
            "pipeline": f"DINOv2 + {'Gemma' if args.mode == 'full' and not args.dry_run else 'clustering'} ({args.model_id})",
            "mode": args.mode,
            "model": args.model_id,
            "rooms": all_rooms,
        }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2, default=lambda o: o.tolist() if isinstance(o, np.ndarray) else o)

    print(f"\n{'='*60}")
    print(f"Resultado salvo em: {args.output}")
    if args.mode != "cls":
        print(f"Salas processadas: {list(output.get('rooms', {}).keys())}")
        total = sum(len(r.get("interactables", [])) for r in output.get("rooms", {}).values())
        print(f"Total de interactables: {total}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
