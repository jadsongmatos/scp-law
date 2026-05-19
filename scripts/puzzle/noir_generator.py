#!/usr/bin/env python3
"""
noir_puzzle_gen.py
Gera puzzles lógicos tipo Einstein com tema noir/detetive e os converte
em interactables/terminals para game_data.json do jogo Murphy Law.

Uso:
python3 -m scripts.puzzle.noir_generator --seed 42 --difficulty hard
python3 -m scripts.puzzle.noir_generator --seed 7 --difficulty easy --output puzzle_data.json
python3 -m scripts.puzzle.noir_generator --seed 1 --difficulty hard --merge src/game_data.json
"""

import argparse
import json
import random
import sys
from pathlib import Path
from typing import Optional

from ortools.sat.python import cp_model

from scripts.shared.config import GAME_DATA_PATH
from scripts.shared.geometry import find_free_position

CATEGORIES = {
    "suspeito": ["Delegado Mendes", "Diretora Elvira", "Seu Jonas", "Zeca do Bar", "Dra. Cunha"],
    "local": ["Armazém 7", "Beco da Rua 14", "Escola Vila Nova", "Delegacia 8º", "Bar Vila Nova"],
    "arma": ["Revólver .38", "Faca de Cozinha", "Arame de Piano", "Chave Inglesa", "Veneno Injetável"],
    "motivo": ["Dívida de Jogo", "Vingança Pessoal", "Tráfico de Crianças", "Extorsão", "Cobertura de Crime"],
    "horario": ["22:00", "23:30", "01:00", "02:30", "04:00"],
}

ROOM_NAMES = ["Escritório Murphy", "Rua Sete", "Bar Vila Nova", "Escola Municipal", "Delegacia 8º"]

HINT_TYPES = [
    "exact",
    "not_exact",
    "same_room",
    "not_same_room",
    "adjacent",
    "not_adjacent",
    "left_of",
    "between_ordered",
    "between_unordered",
]


def build_and_solve(n_rooms: int, seed: int) -> Optional[dict]:
    random.seed(seed)
    cat_names = list(CATEGORIES.keys())
    cat_values = list(CATEGORIES.values())
    n_cats = len(cat_names)
    n = n_rooms

    if n > len(cat_values[0]):
        print(f"[ERRO] n_rooms={n} excede o número de valores em categorias ({len(cat_values[0])})", file=sys.stderr)
        return None

    values = {cat: vals[:n] for cat, vals in zip(cat_names, cat_values)}

    model = cp_model.CpModel()

    pos = {}
    for c in cat_names:
        pos[c] = {}
        for v in values[c]:
            pos[c][v] = model.NewIntVar(0, n - 1, f"pos_{c}_{v}")

    for c in cat_names:
        model.AddAllDifferent(pos[c][v] for v in values[c])

    target = {}
    for c in cat_names:
        rooms_shuffled = list(range(n))
        random.shuffle(rooms_shuffled)
        for i, v in enumerate(values[c]):
            target[pos[c][v]] = rooms_shuffled[i]

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    solver.parameters.random_seed = seed
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    solution = {}
    for c in cat_names:
        solution[c] = {}
        for v in values[c]:
            solution[c][v] = solver.Value(pos[c][v])

    return {
        "n_rooms": n,
        "categories": values,
        "solution": solution,
        "model": model,
        "pos": pos,
        "_seed": seed,
    }


def enumerate_all_hints(puzzle_data: dict) -> list[dict]:
    sol = puzzle_data["solution"]
    values = puzzle_data["categories"]
    cat_names = list(values.keys())
    n = puzzle_data["n_rooms"]
    hints = []

    def room_label(r):
        return ROOM_NAMES[r] if r < len(ROOM_NAMES) else f"Local {r+1}"

    for c in cat_names:
        for v in values[c]:
            room = sol[c][v]
            hints.append({"type": "exact", "cat": c, "val": v, "room": room,
                "text": f"O {c} '{v}' está no {room_label(room)}."})
            for r in range(n):
                if r != room:
                    hints.append({"type": "not_exact", "cat": c, "val": v, "room": r,
                        "text": f"O {c} '{v}' NÃO está no {room_label(r)}."})

    for i, c1 in enumerate(cat_names):
        for c2 in cat_names[i+1:]:
            for v1 in values[c1]:
                for v2 in values[c2]:
                    if sol[c1][v1] == sol[c2][v2]:
                        hints.append({"type": "same_room", "c1": c1, "v1": v1, "c2": c2, "v2": v2,
                            "text": f"O {c1} '{v1}' e o {c2} '{v2}' estão no mesmo local."})
                    else:
                        hints.append({"type": "not_same_room", "c1": c1, "v1": v1, "c2": c2, "v2": v2,
                            "text": f"O {c1} '{v1}' e o {c2} '{v2}' NÃO estão no mesmo local."})

    for c1 in cat_names:
        for c2 in cat_names:
            if c1 == c2:
                continue
            for v1 in values[c1]:
                for v2 in values[c2]:
                    r1, r2 = sol[c1][v1], sol[c2][v2]
                    if abs(r1 - r2) == 1:
                        hints.append({"type": "adjacent", "c1": c1, "v1": v1, "c2": c2, "v2": v2,
                            "text": f"O {c1} '{v1}' está em um local adjacente ao {c2} '{v2}'."})
                    else:
                        hints.append({"type": "not_adjacent", "c1": c1, "v1": v1, "c2": c2, "v2": v2,
                            "text": f"O {c1} '{v1}' NÃO está em um local adjacente ao {c2} '{v2}'."})

    for c1 in cat_names:
        for c2 in cat_names:
            if c1 == c2:
                continue
            for v1 in values[c1]:
                for v2 in values[c2]:
                    r1, r2 = sol[c1][v1], sol[c2][v2]
                    if r1 < r2:
                        hints.append({"type": "left_of", "c1": c1, "v1": v1, "c2": c2, "v2": v2,
                            "text": f"O {c1} '{v1}' está em um local antes do {c2} '{v2}'."})

    for c in cat_names:
        for v_mid in values[c]:
            r_mid = sol[c][v_mid]
            for c1 in cat_names:
                if c1 == c:
                    continue
                for v1 in values[c1]:
                    r1 = sol[c1][v1]
                    for c2 in cat_names:
                        if c2 == c:
                            continue
                        for v2 in values[c2]:
                            r2 = sol[c2][v2]
                            if r1 < r_mid < r2:
                                hints.append({"type": "between_ordered", "c_mid": c, "v_mid": v_mid, "c1": c1, "v1": v1, "c2": c2, "v2": v2,
                                    "text": f"O {c} '{v_mid}' está entre o {c1} '{v1}' e o {c2} '{v2}' (nesta ordem)."})
                            if (r1 < r_mid < r2) or (r2 < r_mid < r1):
                                hints.append({"type": "between_unordered", "c_mid": c, "v_mid": v_mid, "c1": c1, "v1": v1, "c2": c2, "v2": v2,
                                    "text": f"O {c} '{v_mid}' está entre o {c1} '{v1}' e o {c2} '{v2}' (em qualquer ordem)."})

    return hints


def _make_constraint_for_hint(hint: dict, n: int):
    h = hint
    if h["type"] == "exact":
        return lambda m, p: m.Add(p[h["cat"]][h["val"]] == h["room"])
    elif h["type"] == "not_exact":
        return lambda m, p: m.Add(p[h["cat"]][h["val"]] != h["room"])
    elif h["type"] == "same_room":
        return lambda m, p: m.Add(p[h["c1"]][h["v1"]] == p[h["c2"]][h["v2"]])
    elif h["type"] == "not_same_room":
        return lambda m, p: m.Add(p[h["c1"]][h["v1"]] != p[h["c2"]][h["v2"]])
    elif h["type"] == "adjacent":
        def _adj(m, p):
            diff = m.NewIntVar(-(n-1), n-1, f"diff_adj")
            m.Add(diff == p[h["c1"]][h["v1"]] - p[h["c2"]][h["v2"]])
            abs_diff = m.NewIntVar(0, n-1, f"abs_adj")
            m.AddAbsEquality(abs_diff, diff)
            m.Add(abs_diff == 1)
        return _adj
    elif h["type"] == "not_adjacent":
        def _not_adj(m, p):
            diff = m.NewIntVar(-(n-1), n-1, f"diff_notadj")
            m.Add(diff == p[h["c1"]][h["v1"]] - p[h["c2"]][h["v2"]])
            abs_diff = m.NewIntVar(0, n-1, f"abs_notadj")
            m.AddAbsEquality(abs_diff, diff)
            m.Add(abs_diff != 1)
        return _not_adj
    elif h["type"] == "left_of":
        return lambda m, p: m.Add(p[h["c1"]][h["v1"]] < p[h["c2"]][h["v2"]])
    elif h["type"] == "between_ordered":
        def _between_ord(m, p):
            m.Add(p[h["c1"]][h["v1"]] < p[h["c_mid"]][h["v_mid"]])
            m.Add(p[h["c_mid"]][h["v_mid"]] < p[h["c2"]][h["v2"]])
        return _between_ord
    elif h["type"] == "between_unordered":
        def _between_unord(m, p):
            b1 = m.NewBoolVar("b1")
            b2 = m.NewBoolVar("b2")
            m.Add(p[h["c1"]][h["v1"]] < p[h["c_mid"]][h["v_mid"]]).OnlyEnforceIf(b1)
            m.Add(p[h["c_mid"]][h["v_mid"]] < p[h["c2"]][h["v2"]]).OnlyEnforceIf(b1)
            m.Add(p[h["c2"]][h["v2"]] < p[h["c_mid"]][h["v_mid"]]).OnlyEnforceIf(b2)
            m.Add(p[h["c_mid"]][h["v_mid"]] < p[h["c1"]][h["v1"]]).OnlyEnforceIf(b2)
            m.Add(b1 + b2 >= 1)
        return _between_unord
    return lambda m, p: None


def _has_unique_solution(values: dict, n: int,
                          hint_constraints: list,
                          time_limit: float = 30.0) -> bool:
    cat_names = list(values.keys())
    m = cp_model.CpModel()
    p = {}
    for c in cat_names:
        p[c] = {}
        for v in values[c]:
            p[c][v] = m.NewIntVar(0, n - 1, f"pos_{c}_{v}")
    for c in cat_names:
        m.AddAllDifferent(p[c][v] for v in values[c])

    for con in hint_constraints:
        con(m, p)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.random_seed = 42

    status = solver.Solve(m)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return False

    first_sol = {}
    for c in cat_names:
        first_sol[c] = {}
        for v in values[c]:
            first_sol[c][v] = solver.Value(p[c][v])

    diff_bools = []
    for c in cat_names:
        for v in values[c]:
            b = m.NewBoolVar(f"diff_{c}_{v}")
            m.Add(p[c][v] != first_sol[c][v]).OnlyEnforceIf(b)
            diff_bools.append(b)
    m.Add(sum(diff_bools) >= 1)

    solver2 = cp_model.CpSolver()
    solver2.parameters.max_time_in_seconds = time_limit
    solver2.parameters.random_seed = 42
    status2 = solver2.Solve(m)

    return status2 not in (cp_model.OPTIMAL, cp_model.FEASIBLE)


def _count_solutions_with_hints(values: dict, n: int,
                                 hint_constraints: list,
                                 max_count: int = 200,
                                 time_limit: float = 60.0) -> int:
    cat_names = list(values.keys())
    m = cp_model.CpModel()
    p = {}
    for c in cat_names:
        p[c] = {}
        for v in values[c]:
            p[c][v] = m.NewIntVar(0, n - 1, f"pos_{c}_{v}")
    for c in cat_names:
        m.AddAllDifferent(p[c][v] for v in values[c])

    for con in hint_constraints:
        con(m, p)

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.random_seed = 42

    class UniqueSolutionCounter(cp_model.CpSolverSolutionCallback):
        def __init__(self):
            super().__init__()
            self.unique = set()
        def on_solution_callback(self):
            sig = tuple(
                tuple((v, self.Value(p[c][v])) for v in values[c])
                for c in cat_names
            )
            if sig not in self.unique:
                self.unique.add(sig)
            if len(self.unique) >= max_count:
                self.StopSearch()

    callback = UniqueSolutionCounter()
    solver.Solve(m, callback)
    return len(callback.unique)


def select_hints_for_unique_solution(puzzle_data: dict, all_hints: list[dict],
                                      difficulty: str = "medium") -> list[dict]:
    values = puzzle_data["categories"]
    n = puzzle_data["n_rooms"]

    target_counts = {"easy": 18, "medium": 14, "hard": 10}
    min_hints = target_counts.get(difficulty, 14)

    hint_constraints = [_make_constraint_for_hint(h, n) for h in all_hints]

    hints_by_type = {}
    for i, h in enumerate(all_hints):
        hints_by_type.setdefault(h["type"], []).append(i)

    import random as _rng
    _rng.seed(puzzle_data.get("_seed", 42))

    type_order_greedy = [
        "between_ordered", "left_of", "adjacent", "same_room",
        "between_unordered", "not_same_room", "not_adjacent",
        "not_exact", "exact"
    ]

    best_selected = None
    best_constraints = None

    for trial in range(30):
        trial_rng = random.Random(_rng.randint(0, 2**31))

        type_queues = {}
        for htype in type_order_greedy:
            indices = list(hints_by_type.get(htype, []))
            trial_rng.shuffle(indices)
            type_queues[htype] = indices

        sel = []
        sel_con = []
        used = set()
        type_cursors = {ht: 0 for ht in type_order_greedy}

        for _round in range(50):
            added_this_round = False
            for htype in type_order_greedy:
                q = type_queues[htype]
                cur = type_cursors[htype]
                while cur < len(q) and q[cur] in used:
                    cur += 1
                type_cursors[htype] = cur
                if cur >= len(q):
                    continue
                idx = q[cur]
                sel.append(all_hints[idx])
                sel_con.append(hint_constraints[idx])
                used.add(idx)
                type_cursors[htype] = cur + 1
                added_this_round = True
            if len(sel) >= 4 and _has_unique_solution(values, n, sel_con, time_limit=5.0):
                break
            if not added_this_round:
                break
        if len(sel) >= 4 and _has_unique_solution(values, n, sel_con, time_limit=5.0):
            # Early success: record it before leaving the trial loop, otherwise
            # best_selected stays None and `list(best_selected)` below crashes.
            best_selected = list(sel)
            best_constraints = list(sel_con)
            break

        for _pass in range(5):
            removed_any = False
            i = len(sel) - 1
            while i >= 0:
                test_con = sel_con[:i] + sel_con[i+1:]
                if _has_unique_solution(values, n, test_con, time_limit=5.0):
                    sel.pop(i)
                    sel_con = test_con
                    removed_any = True
                i -= 1
            if not removed_any:
                break

        if best_selected is None or len(sel) < len(best_selected):
            best_selected = list(sel)
            best_constraints = list(sel_con)

        if len(best_selected) <= min_hints:
            break

    # Safety net: no trial ever recorded a candidate (e.g. every trial took an
    # unexpected path). Fall back to the last trial's selection instead of
    # crashing on `list(None)`.
    if best_selected is None:
        best_selected = list(sel)
        best_constraints = list(sel_con)

    selected = list(best_selected)
    selected_constraints = list(best_constraints)

    used_indices = set()
    for h in selected:
        for i, ah in enumerate(all_hints):
            if ah is h:
                used_indices.add(i)
                break

    weak_type_order = ["not_same_room", "not_adjacent", "left_of", "adjacent",
                       "between_ordered", "between_unordered", "not_exact", "same_room"]
    while len(selected) < min_hints:
        added = False
        for htype in weak_type_order:
            for widx in hints_by_type.get(htype, []):
                if widx in used_indices:
                    continue
                selected.append(all_hints[widx])
                selected_constraints.append(hint_constraints[widx])
                used_indices.add(widx)
                added = True
                break
            if added:
                break
        if not added:
            break

    while not _has_unique_solution(values, n, selected_constraints, time_limit=30.0):
        added = False
        for idx in hints_by_type.get("exact", []):
            if idx in used_indices:
                continue
            selected.append(all_hints[idx])
            selected_constraints.append(hint_constraints[idx])
            used_indices.add(idx)
            added = True
            break
        if not added:
            break

    changed = True
    while changed:
        changed = False
        for i in range(len(selected) - 1, -1, -1):
            if len(selected) - 1 < min_hints:
                break
            test_constraints = selected_constraints[:i] + selected_constraints[i+1:]
            if _has_unique_solution(values, n, test_constraints, time_limit=10.0):
                selected.pop(i)
                selected_constraints = test_constraints
                changed = True

    final_count = _count_solutions_with_hints(values, n, selected_constraints,
                                               max_count=200, time_limit=120.0)
    return selected, final_count


PUZZLE_ROOMS = ["escritorio", "rua_chuva", "bar", "escola", "delegacia", "beco", "armazem", "diretoria"]


def puzzle_to_interactables(puzzle_data: dict, hints: list[dict],
                             solution_count: int) -> list[dict]:
    sol = puzzle_data["solution"]
    values = puzzle_data["categories"]
    cat_names = list(values.keys())
    n = puzzle_data["n_rooms"]

    interactables = []
    rooms = PUZZLE_ROOMS[:n]

    for i, hint in enumerate(hints):
        room_idx = i % len(rooms)
        interactables.append({
            "id": f"puzzle_hint_{i+1}",
            "room": rooms[room_idx],
            "x": 50.0,
            "y": 50.0,
            "icon": "FileText",
            "type": "terminal_read",
            "label": f"Pista Confidencial #{i+1}",
            "width": 10.0,
            "height": 10.0,
            "description": "Um fragmento de informação recuperado dos arquivos do caso.",
            "documentData": {
                "title": f"PISTA #{i+1}",
                "content": [
                    "> FRAGMENTO RECUPERADO DO ARQUIVO DO CASO",
                    "",
                    hint["text"],
                    "",
                    f"[Tipo de restrição: {hint['type']}]",
                ],
            },
        })

    deduction_content = [
        "═══════════════════════════════════════",
        " MURPHY LAW — SISTEMA DE DEDUÇÃO",
        "═══════════════════════════════════════",
        "",
        "Determine qual suspeito, local, arma,",
        "motivo e horário se conectam.",
        "",
        f"Locais: {', '.join(ROOM_NAMES[:n])}",
        f"Suspeitos: {', '.join(values['suspeito'])}",
        f"Locais do crime: {', '.join(values['local'])}",
        f"Armas: {', '.join(values['arma'])}",
        f"Motivos: {', '.join(values['motivo'])}",
        f"Horários: {', '.join(values['horario'])}",
        "",
        f"Total de pistas coletadas: {len(hints)}",
        f"Solução única: {'SIM' if solution_count == 1 else 'NÃO (' + str(solution_count) + ' soluções)'}",
        "",
        "═══════════════════════════════════════",
    ]

    interactables.append({
        "id": "puzzle_deduction_terminal",
        "room": "delegacia",
        "x": 50.0,
        "y": 60.0,
        "icon": "Terminal",
        "type": "terminal_read",
        "label": "Quadro de Dedução — Caso Helena",
        "width": 12.0,
        "height": 12.0,
        "description": "O quadro de cortiça na delegacia. Fios vermelhos conectam fotos e recortes.",
        "documentData": {
            "title": "SISTEMA DE DEDUÇÃO",
            "content": deduction_content,
        },
    })

    return interactables


def merge_puzzle_into_game_data(game_data_path: str, puzzle_interactables: list[dict],
                                 solution: dict, values: dict) -> dict:
    with open(game_data_path, encoding="utf-8") as f:
        data = json.load(f)

    rooms = data["GAME_ROOMS"]

    for item in puzzle_interactables:
        room_id = item.pop("room")
        if room_id in rooms:
            existing = rooms[room_id].get("interactables", [])
            x, y = find_free_position(room_id, item.get("width", 10.0), item.get("height", 10.0), existing)
            item["x"] = x
            item["y"] = y
            rooms[room_id]["interactables"].append(item)

    cat_names = list(values.keys())
    n = len(list(values.values())[0])

    solution_content = [
        "═══════════════════════════════════════",
        " SOLUÇÃO — CASO HELENA SILVA",
        "═══════════════════════════════════════",
        "",
    ]
    for r in range(n):
        room_label = ROOM_NAMES[r] if r < len(ROOM_NAMES) else f"Local {r+1}"
        solution_content.append(f"► {room_label}:")
        for c in cat_names:
            for v in values[c]:
                if solution[c][v] == r:
                    solution_content.append(f" {c.capitalize()}: {v}")
        solution_content.append("")

    existing_armazem = rooms.get("armazem", {}).get("interactables", [])
    sx, sy = find_free_position("armazem", 10.0, 10.0, existing_armazem)

    rooms["armazem"]["interactables"].append({
        "id": "puzzle_solution_terminal",
        "x": sx,
        "y": sy,
        "icon": "Eye",
        "type": "terminal_read",
        "label": "Envelope Lacrado — Resolução do Caso",
        "width": 10.0,
        "height": 10.0,
        "description": "Um envelope pardo, lacrado com cera vermelha. Contém a verdade.",
        "documentData": {
            "title": "SOLUÇÃO CONFIDENCIAL",
            "content": solution_content,
        },
    })

    return data


def load_config(path: str):
    """Carrega o JSON de input do gerador. Valores ausentes/None caem nos
    defaults hardcoded (CATEGORIES/ROOM_NAMES/PUZZLE_ROOMS). Retorna
    (config, arquivo_encontrado). Flags de CLI sobrescrevem o config."""
    defaults = {
        "seed": 42,
        "difficulty": "medium",
        "n_rooms": 0,
        "categories": CATEGORIES,
        "room_names": ROOM_NAMES,
        "puzzle_rooms": PUZZLE_ROOMS,
    }
    p = Path(path)
    if not p.exists():
        return defaults, False
    with open(p, encoding="utf-8") as f:
        raw = json.load(f)
    merged = dict(defaults)
    for k, v in raw.items():
        if k.startswith("_") or v is None:
            continue
        merged[k] = v
    return merged, True


def main():
    global CATEGORIES, ROOM_NAMES, PUZZLE_ROOMS
    parser = argparse.ArgumentParser(
        description="Gera puzzles lógicos noir/detetive e integra com game_data.json do Murphy Law"
    )
    parser.add_argument("--config", "-c", default="puzzle_input.json",
                        help="JSON de configuração de entrada (padrão: puzzle_input.json)")
    parser.add_argument("--seed", "-s", type=int, default=None, help="Seed (sobrescreve o config)")
    parser.add_argument("--difficulty", "-d", choices=["easy", "medium", "hard"], default=None,
                        help="Dificuldade: easy (18+ pistas), medium (14+), hard (10+) — sobrescreve o config")
    parser.add_argument("--rooms", "-n", type=int, default=None, help="Número de posições (sobrescreve o config; 0=auto)")
    parser.add_argument("--merge", "-m", metavar="GAME_JSON",
                        help="Mescla resultado no game_data.json existente")
    parser.add_argument("--output", "-o", default="puzzle_output.json",
                        help="Arquivo JSON de saída (padrão: puzzle_output.json)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Apenas gera e imprime o puzzle sem salvar")
    args = parser.parse_args()

    # Precedência: flag de CLI > puzzle_input.json > default hardcoded.
    cfg, cfg_found = load_config(args.config)
    CATEGORIES = cfg["categories"]
    ROOM_NAMES = cfg["room_names"]
    PUZZLE_ROOMS = cfg["puzzle_rooms"]
    if args.seed is None:
        args.seed = cfg["seed"]
    if args.difficulty is None:
        args.difficulty = cfg["difficulty"]
    if args.rooms is None:
        args.rooms = cfg["n_rooms"]

    if args.rooms == 0:
        args.rooms = {"easy": 5, "medium": 5, "hard": 4}.get(args.difficulty, 5)

    print(f"Config: {args.config}" if cfg_found else f"Config: {args.config} não encontrado — usando defaults hardcoded")
    print(f"Gerando puzzle noir: seed={args.seed}, locais={args.rooms}, dificuldade={args.difficulty}")
    print()

    puzzle_data = build_and_solve(args.rooms, args.seed)
    if puzzle_data is None:
        print("[ERRO] Não foi possível gerar um puzzle viável.", file=sys.stderr)
        sys.exit(1)

    print(f"✓ Puzzle base gerado com {args.rooms} posições")
    print(f" Categorias: {list(puzzle_data['categories'].keys())}")

    print(f"\nEnumerando pistas possíveis...")
    all_hints = enumerate_all_hints(puzzle_data)
    print(f"✓ {len(all_hints)} pistas possíveis geradas")

    print(f"\nSelecionando pistas para solução única (dificuldade: {args.difficulty})...")
    selected_hints, solution_count = select_hints_for_unique_solution(
        puzzle_data, all_hints, args.difficulty
    )
    print(f"✓ {len(selected_hints)} pistas selecionadas")
    print(f" Soluções encontradas: {solution_count}")
    print(f" Solução única: {'SIM ✓' if solution_count == 1 else 'NÃO ✗'}")

    print(f"\n── Pistas selecionadas ──")
    for i, hint in enumerate(selected_hints, 1):
        print(f" {i:2d}. [{hint['type']}] {hint['text']}")

    sol = puzzle_data["solution"]
    values = puzzle_data["categories"]
    cat_names = list(values.keys())
    print(f"\n── Solução ──")
    for r in range(args.rooms):
        room_label = ROOM_NAMES[r] if r < len(ROOM_NAMES) else f"Local {r+1}"
        items = []
        for c in cat_names:
            for v in values[c]:
                if sol[c][v] == r:
                    items.append(f"{c}={v}")
        print(f" {room_label}: {', '.join(items)}")

    if args.dry_run:
        return

    puzzle_interactables = puzzle_to_interactables(
        puzzle_data, selected_hints, solution_count
    )

    if args.merge:
        print(f"\nMesclando puzzle em {args.merge}...")
        merged = merge_puzzle_into_game_data(args.merge, puzzle_interactables, sol, values)
        with open(args.merge, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)
        print(f"✓ Puzzle mesclado em {args.merge}")
    else:
        output = {
            "puzzle": {
                "seed": args.seed,
                "difficulty": args.difficulty,
                "n_rooms": args.rooms,
                "categories": values,
                "solution": sol,
                "hint_count": len(selected_hints),
                "unique_solution": solution_count == 1,
            },
            "hints": selected_hints,
            "interactables": puzzle_interactables,
        }
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"\n✓ Saída salva em {args.output}")

    print("\nFeito!")


if __name__ == "__main__":
    main()
