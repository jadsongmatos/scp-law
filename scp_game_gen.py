#!/usr/bin/env python3
"""
scp_game_gen.py
Gera um game_data.json no formato do jogo SCP a partir de páginas
reais da SCP Foundation Wiki (scp-wiki.wikidot.com).

Uso:
    python3 scp_game_gen.py 173 049 096 682
    python3 scp_game_gen.py 173 049 096 --output meu_mapa.json
    python3 scp_game_gen.py 173 049 096 --lang pt  # traduz via LibreTranslate (local)
"""

import argparse
import json
import random
import sys
import time
from textwrap import shorten
from typing import Optional

import requests
from bs4 import BeautifulSoup

# ─── Configuração ────────────────────────────────────────────────────────────

WIKI_BASE      = "https://scp-wiki.wikidot.com/scp-{}"
REQUEST_DELAY  = 1.5          # segundos entre requests (respeita o servidor)
MAX_DESC_CHARS = 400          # caracteres máx. de descrição por interactable
SESSION_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# Mapeia classe do objeto → nível do cartão de acesso
CLASS_TO_LEVEL: dict[str, int] = {
    "safe":       1,
    "euclid":     2,
    "keter":      3,
    "thaumiel":   3,
    "apollyon":   3,
    "neutralized": 1,
}

# Ícones por classe (lucide-react)
CLASS_ICON: dict[str, str] = {
    "safe":       "ShieldCheck",
    "euclid":     "Ghost",
    "keter":      "Skull",
    "thaumiel":   "Eye",
    "apollyon":   "Flame",
}

# Salas fixas que existem independente dos SCPs buscados
FIXED_ROOMS = ["entrance", "corridor", "server_room", "containment"]

# ─── Scraping ────────────────────────────────────────────────────────────────

def fetch_scp_page(number: str) -> Optional[BeautifulSoup]:
    """Baixa e parseia a página de um SCP. Retorna None em caso de falha."""
    url = WIKI_BASE.format(number.lstrip("0") if int(number) != 0 else "0")
    try:
        resp = requests.get(url, headers=SESSION_HEADERS, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")
        if not soup.find("div", id="page-content"):
            print(f"  [!] SCP-{number}: conteúdo não encontrado na página.", file=sys.stderr)
            return None
        return soup
    except requests.RequestException as exc:
        print(f"  [!] SCP-{number}: erro de rede — {exc}", file=sys.stderr)
        return None


def _extract_after_bold(content: BeautifulSoup, label: str) -> str:
    """Extrai o texto que vem logo após um <strong>label</strong>."""
    for tag in content.find_all(["p", "div", "blockquote"]):
        bold = tag.find("strong")
        if bold and label.lower() in bold.get_text().lower():
            # Clona para não destruir o original
            clone = BeautifulSoup(str(tag), "html.parser").find(tag.name)
            clone.find("strong").decompose()
            text = clone.get_text(" ", strip=True)
            # Remove quebras múltiplas
            text = " ".join(text.split())
            return text
    return ""


def _paragraphs_after_bold(content: BeautifulSoup, label: str, max_paragraphs: int = 3) -> str:
    """
    Retorna os parágrafos que seguem um cabeçalho <strong>label</strong>,
    útil para 'Special Containment Procedures' e 'Description'.
    """
    found = False
    chunks: list[str] = []
    for tag in content.find_all(["p", "blockquote", "ul", "ol"]):
        bold = tag.find("strong")
        if bold and label.lower() in bold.get_text().lower():
            # Tenta capturar o restante do mesmo parágrafo
            clone = BeautifulSoup(str(tag), "html.parser").find(tag.name)
            clone.find("strong").decompose()
            inline = clone.get_text(" ", strip=True)
            if inline:
                chunks.append(inline)
            found = True
            continue
        if found:
            text = tag.get_text(" ", strip=True)
            if text:
                chunks.append(text)
            if len(chunks) >= max_paragraphs:
                break
    return " ".join(chunks)


def parse_scp(soup: BeautifulSoup, number: str) -> dict:
    """Extrai campos relevantes de uma página SCP parseada."""
    content = soup.find("div", id="page-content")

    # Título da página
    title_tag = soup.find("div", id="page-title")
    title = title_tag.get_text(strip=True) if title_tag else f"SCP-{number}"

    object_class_raw = _extract_after_bold(content, "Object Class") or "Unknown"
    object_class     = object_class_raw.split()[0].lower()   # "Euclid (provisional)" → "euclid"

    containment = _paragraphs_after_bold(content, "Special Containment Procedures", max_paragraphs=2)
    description = _paragraphs_after_bold(content, "Description", max_paragraphs=2)

    # Fallback: pega os primeiros parágrafos com texto
    if not description:
        paras = [p.get_text(" ", strip=True) for p in content.find_all("p") if len(p.get_text(strip=True)) > 60]
        description = " ".join(paras[:2])

    return {
        "number":       number,
        "title":        title,
        "object_class": object_class,
        "access_level": CLASS_TO_LEVEL.get(object_class, 2),
        "containment":  shorten(containment,  width=MAX_DESC_CHARS, placeholder="..."),
        "description":  shorten(description,   width=MAX_DESC_CHARS, placeholder="..."),
    }


# ─── Construção do JSON ──────────────────────────────────────────────────────

def build_item_names(scps: list[dict]) -> dict:
    base = {
        "keycard_1": "Cartão Nível 1",
        "keycard_2": "Cartão Nível 2",
        "keycard_3": "Cartão Nível 3",
    }
    return base


def _scp_room_id(number: str) -> str:
    return f"scp_{number}_room"


def _keycard_for_level(level: int) -> str:
    return f"keycard_{level}"


def build_rooms(scps: list[dict]) -> dict:
    """
    Monta todas as salas:
      entrance → corridor → scp_XXX_room (uma por SCP) → server_room → containment
    """
    rooms: dict = {}

    # ── Entrance ────────────────────────────────────────────────────────────
    rooms["entrance"] = {
        "id":          "entrance",
        "name":        "Setor de Triagem [ENTRADA]",
        "description": (
            "A luz de emergência vermelha pisca ritmicamente. "
            "Há sangue seco no chão. O ar está pesado, cheirando a ozônio e cobre."
        ),
        "interactables": [
            {
                "id":              "door_corridor",
                "x":               50, "y": 30,
                "icon":            "DoorClosed",
                "type":            "travel",
                "label":           "Porta para o Corredor Leste",
                "requiredItem":    "keycard_1",
                "failedMessage":   "[ACESSO NEGADO] Requer Cartão de Acesso Nível 1.",
                "successMessage":  "O leitor apitou verde. Porta destrancada.",
                "targetRoom":      "corridor",
            },
            {
                "id":          "guard_desk",
                "x":           20, "y": 70,
                "icon":        "Search",
                "type":        "inspect",
                "label":       "Mesa do Segurança",
                "description": (
                    "Um segurança morto repousa sobre o teclado. "
                    "O pescoço dele está quebrado de um jeito não natural."
                ),
            },
            {
                "id":              "keycard_1_pickup",
                "x":               25, "y": 75,
                "icon":            "Key",
                "type":            "pickup",
                "label":           "Cartão Nível 1",
                "description":     "Você pegou o Cartão de Acesso Nível 1 caído debaixo da mesa.",
                "pickupItem":      "keycard_1",
                "hideAfterInteract": True,
            },
        ],
    }

    # ── Corridor (hub) ──────────────────────────────────────────────────────
    # Porta para cada sala de SCP
    corridor_doors: list[dict] = [
        {
            "id":         "door_entrance",
            "x":          50, "y": 90,
            "icon":       "DoorOpen",
            "type":       "travel",
            "label":      "Voltar para Triagem",
            "targetRoom": "entrance",
        }
    ]

    total = len(scps)
    for i, scp in enumerate(scps):
        room_id = _scp_room_id(scp["number"])
        level   = scp["access_level"]
        # Distribui as portas horizontalmente (evita sobreposição)
        x_pos = int(10 + (80 / max(total, 1)) * i + (80 / max(total, 1)) / 2)
        y_pos = 40

        door: dict = {
            "id":    f"door_{room_id}",
            "x":     x_pos,
            "y":     y_pos,
            "icon":  "DoorClosed" if level > 1 else "DoorOpen",
            "type":  "travel",
            "label": f"Sala de Contenção — SCP-{scp['number']}",
            "targetRoom": room_id,
        }
        if level > 1:
            door["requiredItem"]   = _keycard_for_level(level)
            door["failedMessage"]  = f"[ACESSO NEGADO] Requer Cartão de Acesso Nível {level}."
            door["successMessage"] = "Trancas liberadas. Entrando no setor..."
        corridor_doors.append(door)

    # Porta para sala dos servidores (keycard_2)
    corridor_doors.append({
        "id":            "door_server",
        "x":             80, "y": 20,
        "icon":          "Archive",
        "type":          "travel",
        "label":         "Sala dos Servidores",
        "requiredItem":  "keycard_2",
        "failedMessage": "[ACESSO NEGADO] Requer Cartão de Acesso Nível 2.",
        "targetRoom":    "server_room",
    })

    # Porta para contenção final (keycard_3)
    corridor_doors.append({
        "id":              "door_containment",
        "x":               20, "y": 20,
        "icon":            "Lock",
        "type":            "travel",
        "label":           "Ala de Contenção Euclidiana",
        "requiredItem":    "keycard_3",
        "failedMessage":   "[ISOLAMENTO] Requer Cartão de Acesso Nível 3.",
        "successMessage":  "Trancas pneumáticas liberadas. Entrando no setor de risco...",
        "targetRoom":      "containment",
    })

    rooms["corridor"] = {
        "id":          "corridor",
        "name":        "Corredor Leste — Nível 2",
        "description": (
            "Lâmpadas fluorescentes estouradas. Marcas nas paredes como se alguém "
            "tivesse tentado se segurar com força. O silêncio pesa."
        ),
        "interactables": corridor_doors,
    }

    # ── Uma sala por SCP ────────────────────────────────────────────────────
    for scp in scps:
        room_id    = _scp_room_id(scp["number"])
        icon       = CLASS_ICON.get(scp["object_class"], "Ghost")
        obj_class  = scp["object_class"].capitalize()
        level      = scp["access_level"]

        interactables = [
            {
                "id":         f"door_back_{room_id}",
                "x":          50, "y": 90,
                "icon":       "DoorOpen",
                "type":       "travel",
                "label":      "Voltar para o Corredor",
                "targetRoom": "corridor",
            },
            {
                "id":    f"cell_{room_id}",
                "x":     50, "y": 30,
                "icon":  icon,
                "type":  "inspect",
                "label": f"Cela de Contenção — SCP-{scp['number']}",
                "description": scp["description"] or "A cela está escura demais para ver qualquer coisa.",
            },
            {
                "id":    f"terminal_{room_id}",
                "x":     20, "y": 50,
                "icon":  "FileText",
                "type":  "terminal_read",
                "label": f"Arquivo Físico: SCP-{scp['number']}",
                "documentData": {
                    "title":   f"ARQUIVO: SCP-{scp['number']}",
                    "content": [
                        f"Item nº: SCP-{scp['number']}",
                        f"Classe do Objeto: {obj_class}",
                        f"Nível de Acesso Requerido: {level}",
                        "",
                        "Procedimentos de Contenção Especiais:",
                        scp["containment"] or "ARQUIVO CORROMPIDO.",
                        "",
                        "Descrição:",
                        scp["description"] or "ARQUIVO CORROMPIDO.",
                    ],
                },
            },
        ]

        # Keycard de nível mais alto nesta sala (para progressão)
        if level >= 2:
            next_level = min(level + 1, 3)
            interactables.append({
                "id":              f"keycard_{next_level}_pickup_{room_id}",
                "x":               75, "y": 65,
                "icon":            "Key",
                "type":            "pickup",
                "label":           f"Cartão Nível {next_level}",
                "description":     f"Você encontrou um Cartão de Acesso Nível {next_level} nesta sala.",
                "pickupItem":      f"keycard_{next_level}",
                "hideAfterInteract": True,
            })

        rooms[room_id] = {
            "id":          room_id,
            "name":        f"Câmara de Contenção — SCP-{scp['number']} [{obj_class.upper()}]",
            "description": (
                f"Esta sala abrigava o SCP-{scp['number']}. "
                "Marcas de contenção reforçada cobrem as paredes."
            ),
            "interactables": interactables,
        }

    # ── Server Room ─────────────────────────────────────────────────────────
    rooms["server_room"] = {
        "id":          "server_room",
        "name":        "Sala dos Servidores Táticos",
        "description": "Frio. Racks de servidores zumbem alto. Este é o cérebro das câmeras de contenção.",
        "interactables": [
            {
                "id":         "door_office_back",
                "x":          50, "y": 90,
                "icon":       "DoorOpen",
                "type":       "travel",
                "label":      "Voltar para Corredor",
                "targetRoom": "corridor",
            },
            {
                "id":    "server_terminal",
                "x":     50, "y": 30,
                "icon":  "Database",
                "type":  "terminal_read",
                "label": "SISTEMA DE CONTENÇÃO PRINCIPAL",
                "documentData": {
                    "title":   "SISTEMA SCP OS",
                    "content": [
                        "> ACESSANDO DADOS...",
                        "> ALERTA: SISTEMA COMPROMETIDO",
                        "",
                        *[
                            f"SCP-{s['number']}: CONTENÇÃO {'ATIVA' if random.random() > 0.5 else 'FALHOU — LOCALIZAÇÃO DESCONHECIDA'}"
                            for s in scps
                        ],
                        "",
                        ">> ACESSE A ALA DE CONTENÇÃO EUCLIDIANA COM URGÊNCIA. <<",
                    ],
                },
            },
            {
                "id":              "keycard_3_pickup",
                "x":               80, "y": 70,
                "icon":            "Key",
                "type":            "pickup",
                "label":           "Cartão Nível 3",
                "description":     "Você encontrou o Cartão de Acesso Nível 3 deixado por um pesquisador.",
                "pickupItem":      "keycard_3",
                "hideAfterInteract": True,
            },
        ],
    }

    # ── Containment (final) ─────────────────────────────────────────────────
    rooms["containment"] = {
        "id":          "containment",
        "name":        "Ala de Contenção Euclidiana",
        "description": (
            "Sombras oscilam. Portas de contenção abertas. "
            "O silêncio aqui é diferente — é o tipo que precede algo."
        ),
        "interactables": [
            {
                "id":         "door_corridor_back",
                "x":          50, "y": 90,
                "icon":       "DoorOpen",
                "type":       "travel",
                "label":      "Voltar para Corredor (Fuga)",
                "targetRoom": "corridor",
            },
            {
                "id":    "containment_cell",
                "x":     50, "y": 30,
                "icon":  "Ghost",
                "type":  "inspect",
                "label": "Cela Central de Contenção",
                "description": (
                    "Vazia. Traços biológicos cobrem o chão. "
                    "Você ouve algo se mover atrás de você. NÃO SE VIRE."
                ),
            },
            {
                "id":    "finale_terminal",
                "x":     20, "y": 50,
                "icon":  "Terminal",
                "type":  "terminal_read",
                "label": "Terminal de Evacuação (FIM)",
                "documentData": {
                    "title":   "AVISO DE EVACUAÇÃO",
                    "content": [
                        "Protocolo de bloqueio ativado.",
                        "MTF Epsilon-11 ('Raposas das Nove Caudas') entrou nas instalações.",
                        "Sua investigação permitiu mapear os perigos a tempo.",
                        "",
                        ">>> VOCÊ SOBREVIVEU À QUEBRA DE CONTENÇÃO. <<<",
                        "",
                        "SCPs envolvidos neste incidente:",
                        *[f"  - SCP-{s['number']} [{s['object_class'].upper()}]" for s in scps],
                        "",
                        "Dados baseados nos artigos da SCP Foundation Wiki (scp-wiki.wikidot.com).",
                    ],
                },
            },
        ],
    }

    return rooms


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Gera game_data.json a partir da SCP Foundation Wiki."
    )
    parser.add_argument(
        "numbers",
        nargs="+",
        metavar="SCP_NUMBER",
        help="Números dos SCPs para incluir (ex: 173 049 096)",
    )
    parser.add_argument(
        "--output", "-o",
        default="game_data.json",
        metavar="FILE",
        help="Arquivo JSON de saída (padrão: game_data.json)",
    )
    parser.add_argument(
        "--delay", "-d",
        type=float,
        default=REQUEST_DELAY,
        metavar="SEGUNDOS",
        help=f"Delay entre requisições (padrão: {REQUEST_DELAY}s)",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Gera JSON com dados fictícios sem acessar a internet (para testes)",
    )
    args = parser.parse_args()

    scps: list[dict] = []

    for number in args.numbers:
        # Normaliza: "173", "SCP-173", "scp173" → "173"
        normalized = number.upper().replace("SCP-", "").replace("SCP", "").strip()

        if args.mock:
            mock_classes = ["safe", "euclid", "keter"]
            obj_class    = mock_classes[hash(normalized) % 3]
            scps.append({
                "number":       normalized,
                "title":        f"SCP-{normalized}",
                "object_class": obj_class,
                "access_level": CLASS_TO_LEVEL.get(obj_class, 2),
                "containment":  f"[MOCK] O SCP-{normalized} deve ser mantido em contenção padrão de nível {CLASS_TO_LEVEL.get(obj_class, 2)}.",
                "description":  f"[MOCK] SCP-{normalized} é uma entidade anômala de classe {obj_class.capitalize()}.",
            })
            print(f"  [MOCK] SCP-{normalized} gerado localmente.")
            continue

        print(f"  Buscando SCP-{normalized}...", end=" ", flush=True)
        soup = fetch_scp_page(normalized)
        if soup is None:
            print("FALHOU — pulando.")
            continue

        data = parse_scp(soup, normalized)
        scps.append(data)
        print(f"OK [{data['object_class'].upper()}]")

        if normalized != args.numbers[-1]:
            time.sleep(args.delay)

    if not scps:
        print("\nNenhum SCP foi carregado. Use --mock para testes.", file=sys.stderr)
        sys.exit(1)

    print(f"\nConstruindo JSON com {len(scps)} SCP(s)...")

    game_data = {
        "ITEM_NAMES": build_item_names(scps),
        "GAME_ROOMS": build_rooms(scps),
    }

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(game_data, f, ensure_ascii=False, indent=2)

    print(f"Salvo em: {args.output}")
    print(f"  Salas geradas: {list(game_data['GAME_ROOMS'].keys())}")


if __name__ == "__main__":
    main()
