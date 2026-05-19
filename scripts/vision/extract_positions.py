#!/usr/bin/env python3
"""
extract_positions.py
Pipeline YOLO + Gemma-4-31b-it (via OpenRouter) para extrair posições de itens
nas imagens de cenário do jogo SCP.

Fluxo:
1. YOLO (ultralytics) detecta objetos na imagem → bounding boxes + labels
2. Bounding boxes são convertidas para coordenadas normalizadas (0-100%)
3. Gemma-4-31b-it recebe a imagem + detecções YOLO e classifica/refina
   cada item no contexto do jogo SCP (portas, terminais, keycards, etc.)
4. Gera interactivables no formato do game_data.json

Uso:
python3 -m scripts.vision.extract_positions src/assets/images/scp_entrance_*.png
python3 -m scripts.vision.extract_positions src/assets/images/scp_entrance_*.png --room entrance
python3 -m scripts.vision.extract_positions src/assets/images/*.png --all
python3 -m scripts.vision.extract_positions src/assets/images/scp_entrance_*.png --yolo-model yolov8x.pt
python3 -m scripts.vision.extract_positions src/assets/images/scp_entrance_*.png --dry-run

Env:
OPENROUTER_API_KEY - Chave da API OpenRouter (obrigatório)
"""

import argparse
import base64
import json
import os
import sys
from pathlib import Path
from io import BytesIO

import requests
from PIL import Image

try:
    from ultralytics import YOLO
except ImportError:
    print("ERRO: ultralytics não instalado. Execute: pip install ultralytics", file=sys.stderr)
    sys.exit(1)

from scripts.shared.config import (
    OPENROUTER_API_URL, OPENROUTER_API_KEY, GEMMA_MODEL, NOIR_IMAGE_DIR, PROJECT_ROOT,
)
from scripts.shared.openrouter import HEADERS

DEFAULT_YOLO_MODEL = "yolov8x.pt"

ICON_MAP = {
    "door": "DoorClosed",
    "door_open": "DoorOpen",
    "keyboard": "Search",
    "key": "Key",
    "monitor": "Search",
    "chair": "Search",
    "book": "FileText",
    "clock": "Search",
    "tv": "Monitor",
    "laptop": "Search",
    "cell_phone": "Search",
    "bottle": "Search",
    "cup": "Search",
    "backpack": "Search",
    "umbrella": "Search",
    "suitcase": "Search",
    "person": "Ghost",
    "default": "Search",
}

ACTION_TYPE_MAP = {
    "door": "travel",
    "door_open": "travel",
    "key": "pickup",
    "keyboard": "inspect",
    "monitor": "inspect",
    "book": "terminal_read",
    "laptop": "terminal_read",
    "tv": "terminal_read",
    "cell_phone": "inspect",
    "default": "inspect",
}

KNOWN_ROOMS = {
    "entrance": "Setor de Triagem [ENTRADA]",
    "corridor": "Corredor Leste — Nível 2",
    "scp_173_room": "Câmara de Contenção — SCP-173 [EUCLID]",
    "scp_049_room": "Câmara de Contenção — SCP-049 [KETER]",
    "scp_096_room": "Câmara de Contenção — SCP-096 [EUCLID]",
    "scp_682_room": "Câmara de Contenção — SCP-682 [SAFE]",
    "server_room": "Sala dos Servidores Táticos",
    "containment": "Ala de Contenção Euclidiana",
}

YOLO_TO_GAME_CONTEXT = {
    "door": "porta, entrada ou saída de uma sala da fundação SCP",
    "keyboard": "teclado de computador ou terminal de acesso",
    "monitor": "monitor de computador ou tela de terminal",
    "laptop": "laptop de pesquisador da fundação",
    "book": "documentação ou arquivo SCP",
    "chair": "cadeira de escritório ou mobília",
    "cup": "copo ou recipiente deixado por pesquisador",
    "bottle": "garrafa ou recipiente de substância",
    "clock": "relógio ou dispositivo de temporização",
    "tv": "tela de monitoramento de câmeras",
    "cell_phone": "dispositivo de comunicação",
    "backpack": "mochila ou equipamento",
    "person": "corpo ou presença humana",
    "key": "cartão de acesso ou chave",
}


def encode_image_base64(image_path: str, max_size: int = 1536) -> tuple[str, str]:
    img = Image.open(image_path)
    if max(img.size) > max_size:
        ratio = max_size / max(img.size)
        img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=85)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return b64, "image/jpeg"


def run_yolo(image_path: str, model_path: str = DEFAULT_YOLO_MODEL, conf: float = 0.25) -> list[dict]:
    model = YOLO(model_path)
    results = model(image_path, conf=conf, verbose=False)

    detections = []
    img_w = results[0].orig_shape[1]
    img_h = results[0].orig_shape[0]

    for box in results[0].boxes:
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        cls_id = int(box.cls[0])
        cls_name = results[0].names[cls_id]
        confidence = float(box.conf[0])

        x_center = ((x1 + x2) / 2) / img_w * 100
        y_center = ((y1 + y2) / 2) / img_h * 100
        width = (x2 - x1) / img_w * 100
        height = (y2 - y1) / img_h * 100

        detections.append({
            "yolo_class": cls_name,
            "confidence": round(confidence, 3),
            "x": round(x_center, 1),
            "y": round(y_center, 1),
            "width": round(width, 1),
            "height": round(height, 1),
            "bbox_px": {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)},
        })

    return detections


def classify_with_gemma(
    image_path: str,
    detections: list[dict],
    room_id: str,
    api_key: str,
) -> list[dict]:
    b64_img, mime = encode_image_base64(image_path)
    detections_text = json.dumps(detections, indent=2, ensure_ascii=False)

    prompt = f"""Você é um analisador de cenários para um jogo de investigação SCP (Fundação SCP).
Analise a imagem de cenário fornecida junto com as detecções de objetos do YOLO abaixo.

Sala atual: {room_id} — {KNOWN_ROOMS.get(room_id, 'Desconhecida')}

Detecções YOLO (coordenadas em porcentagem 0-100%):
{detections_text}

Para CADA detecção YOLO, refine e classifique no contexto do jogo SCP. Você deve:
1. Identificar o que o objeto realmente representa no cenário SCP (ex: "door" pode ser uma porta de contenção, "keyboard" pode ser um terminal de acesso)
2. Atribuir um tipo de ação: "travel" (portas/passagens), "pickup" (itens coletáveis como keycards), "inspect" (objetos examináveis), "terminal_read" (terminais/documentos)
3. Atribuir um ícone lucide-react apropriado: DoorClosed, DoorOpen, Key, Search, FileText, Ghost, Skull, ShieldCheck, Archive, Lock, Terminal, Database, Eye, Flame, Monitor, Bug
4. Criar um label descritivo em português brasileiro
5. Criar uma description imersiva em português (tom de terror/suspense)
6. Ajustar coordenadas se perceber que o YOLO errou na posição relativa

Regras:
- Portas que levam a outras salas devem ter type "travel" e targetRoom preenchido
- Itens coletáveis (keycards, chaves) devem ter type "pickup", pickupItem e hideAfterInteract: true
- Terminais/documentos devem ter type "terminal_read" com documentData
- Objetos decorativos devem ter type "inspect"
- Se a detecção YOLO for um falso positivo (não é relevante para o jogo), exclua-a
- Se houver itens importantes no cenário que o YOLO NÃO detectou, adicione-os com coordenadas estimadas

Retorne APENAMENTE um JSON no formato:
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
      "label": "Porta de Contenção",
      "description": "Uma porta de aço reforçado com trinca pneumática.",
      "targetRoom": "corridor",
      "requiredItem": "keycard_1",
      "failedMessage": "[ACESSO NEGADO] Requer Cartão Nível 1.",
      "successMessage": "Trancas liberadas.",
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
        "X-Title": "SCP Game Position Extractor",
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


def quick_map_yolo(detections: list[dict]) -> list[dict]:
    interactables = []
    for i, det in enumerate(detections):
        yolo_cls = det["yolo_class"]
        icon = ICON_MAP.get(yolo_cls, ICON_MAP["default"])
        action_type = ACTION_TYPE_MAP.get(yolo_cls, ACTION_TYPE_MAP["default"])

        interactables.append({
            "id": f"yolo_{yolo_cls}_{i}",
            "x": det["x"],
            "y": det["y"],
            "width": det["width"],
            "height": det["height"],
            "icon": icon,
            "type": action_type,
            "label": yolo_cls.replace("_", " ").title(),
            "description": f"[YOLO auto] Objeto detectado: {yolo_cls} (conf: {det['confidence']})",
            "yolo_class": yolo_cls,
            "yolo_confidence": det["confidence"],
        })

    return interactables


def process_image(
    image_path: str,
    room_id: str,
    api_key: str | None,
    yolo_model: str,
    conf: float,
    dry_run: bool,
) -> dict:
    print(f"\n{'='*60}")
    print(f"Processando: {image_path}")
    print(f"Sala: {room_id} — {KNOWN_ROOMS.get(room_id, 'Desconhecida')}")
    print(f"{'='*60}")

    print("\n[1/2] Executando YOLO...")
    detections = run_yolo(image_path, yolo_model, conf)
    print(f" {len(detections)} objetos detectados")
    for d in detections:
        print(f" - {d['yolo_class']}: ({d['x']:.1f}%, {d['y']:.1f}%) conf={d['confidence']}")

    if dry_run:
        print("\n[DRY-RUN] Pulando chamada ao Gemma. Usando mapeamento rápido YOLO→game.")
        interactables = quick_map_yolo(detections)
    elif not api_key:
        print("\n[!] OPENROUTER_API_KEY não definida. Usando mapeamento rápido YOLO→game.")
        interactables = quick_map_yolo(detections)
    else:
        print("\n[2/2] Classificando com Gemma-4-31b-it via OpenRouter...")
        interactables = classify_with_gemma(image_path, detections, room_id, api_key)
        print(f" {len(interactables)} interactivables gerados pelo Gemma")

    for item in interactables:
        item.setdefault("width", 8)
        item.setdefault("height", 10)

    room_data = {
        "id": room_id,
        "name": KNOWN_ROOMS.get(room_id, room_id.replace("_", " ").title()),
        "interactables": interactables,
        "yolo_detections": detections,
    }

    return room_data


def guess_room_id(image_path: str) -> str:
    name = Path(image_path).stem.lower()
    for room_key in KNOWN_ROOMS:
        if room_key in name:
            return room_key
    if "entrance" in name or "entrada" in name:
        return "entrance"
    if "corridor" in name or "corredor" in name:
        return "corridor"
    if "server" in name or "servidor" in name:
        return "server_room"
    if "containment" in name or "contencao" in name:
        return "containment"
    if "office" in name or "escritorio" in name:
        return "scp_173_room"
    return "unknown_room"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extrai posições de itens em imagens de cenário SCP via YOLO + Gemma-4-31b-it (OpenRouter)."
    )
    parser.add_argument("images", nargs="+", metavar="IMAGE",
                        help="Caminho(s) para imagem(ns) de cenário")
    parser.add_argument("--room", "-r", metavar="ROOM_ID",
                        help="ID da sala (ex: entrance, corridor, scp_173_room). Auto-detectado se omitido.")
    parser.add_argument("--yolo-model", default=DEFAULT_YOLO_MODEL, metavar="MODEL",
                        help=f"Modelo YOLO (padrão: {DEFAULT_YOLO_MODEL})")
    parser.add_argument("--conf", type=float, default=0.25, metavar="FLOAT",
                        help="Confiança mínima YOLO (padrão: 0.25)")
    parser.add_argument("--output", "-o", default=str(PROJECT_ROOT / "extracted_positions.json"),
                        metavar="FILE", help="Arquivo JSON de saída")
    parser.add_argument("--dry-run", action="store_true",
                        help="Apenas YOLO, sem chamar a API do Gemma (modo offline)")
    args = parser.parse_args()

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key and not args.dry_run:
        print("[!] OPENROUTER_API_KEY não definida. Use --dry-run ou export a variável.", file=sys.stderr)
        print(" Modo dry-run será usado.", file=sys.stderr)

    all_rooms = {}

    for image_path in args.images:
        if not Path(image_path).exists():
            print(f"[!] Imagem não encontrada: {image_path}", file=sys.stderr)
            continue

        room_id = args.room or guess_room_id(image_path)

        room_data = process_image(
            image_path=image_path,
            room_id=room_id,
            api_key=api_key,
            yolo_model=args.yolo_model,
            conf=args.conf,
            dry_run=args.dry_run,
        )
        all_rooms[room_id] = room_data

    output = {
        "pipeline": "YOLO + Gemma-4-31b-it (OpenRouter)",
        "model": GEMMA_MODEL,
        "yolo_model": args.yolo_model,
        "rooms": all_rooms,
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*60}")
    print(f"Resultado salvo em: {args.output}")
    print(f"Salas processadas: {list(all_rooms.keys())}")
    total_items = sum(len(r["interactables"]) for r in all_rooms.values())
    print(f"Total de interactivables: {total_items}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
