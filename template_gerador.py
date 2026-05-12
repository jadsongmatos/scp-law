"""
Template 2 — Gerador automático de puzzles Einstein's Riddle

Fluxo:
  1. Sorteia uma solução aleatória
  2. Gera TODAS as dicas possíveis (same, exact_left, somewhere_left,
     neighbor, at_position, at_end, between_ordered, between_unordered)
  3. Greedy shuffle: adiciona dicas aleatoriamente até solução única
  4. Poda: remove toda dica redundante
  5. Imprime o puzzle com unicidade verificada
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from puzzle import Puzzle, EinsteinModel, print_solution

import random
import itertools


# ─────────────────────────────────────────────
#  Passo 1 — Solução aleatória
# ─────────────────────────────────────────────

def random_solution(categories: dict, n: int, rng: random.Random) -> dict:
    sol = {}
    for cat, vals in categories.items():
        perm = list(range(n))
        rng.shuffle(perm)
        sol[cat] = {v: p for v, p in zip(vals, perm)}
    return sol


# ─────────────────────────────────────────────
#  Passo 2 — Gerar todas as dicas verdadeiras
# ─────────────────────────────────────────────

def generate_all_clues(solution: dict, categories: dict, n: int) -> list[dict]:
    clues = []
    all_pairs = [(cat, val) for cat, vals in categories.items() for val in vals]

    # ── Pares ─────────────────────────────────
    for (c1, v1), (c2, v2) in itertools.combinations(all_pairs, 2):
        if c1 == c2:
            continue
        p1, p2 = solution[c1][v1], solution[c2][v2]

        if p1 == p2:
            clues.append({"type": "same", "args": (c1, v1, c2, v2),
                          "text": f"{v1} ({c1}) está na mesma posição que {v2} ({c2})."})
        if p1 < p2:
            clues.append({"type": "somewhere_left", "args": (c1, v1, c2, v2),
                          "text": f"{v1} ({c1}) está à esquerda de {v2} ({c2})."})
        if p2 < p1:
            clues.append({"type": "somewhere_left", "args": (c2, v2, c1, v1),
                          "text": f"{v2} ({c2}) está à esquerda de {v1} ({c1})."})
        if p1 == p2 - 1:
            clues.append({"type": "exact_left", "args": (c1, v1, c2, v2),
                          "text": f"{v1} ({c1}) está exatamente à esquerda de {v2} ({c2})."})
        if p2 == p1 - 1:
            clues.append({"type": "exact_left", "args": (c2, v2, c1, v1),
                          "text": f"{v2} ({c2}) está exatamente à esquerda de {v1} ({c1})."})
        if abs(p1 - p2) == 1:
            clues.append({"type": "neighbor", "args": (c1, v1, c2, v2),
                          "text": f"{v1} ({c1}) é vizinho de {v2} ({c2})."})

    # ── Fixas ──────────────────────────────────
    for cat, vals in categories.items():
        for v in vals:
            pos = solution[cat][v]
            clues.append({"type": "at_position", "args": (cat, v, pos + 1),
                          "text": f"{v} ({cat}) está na posição {pos + 1}."})
            if pos == 0 or pos == n - 1:
                clues.append({"type": "at_end", "args": (cat, v),
                              "text": f"{v} ({cat}) está em uma das pontas."})

    # ── Trios: between_ordered ─────────────────
    # Para cada permutação de 3 pares de categorias distintas,
    # verifica se p_a < p_mid < p_b.
    seen_ordered = set()
    for (c_mid, v_mid), (c_a, v_a), (c_b, v_b) in itertools.permutations(all_pairs, 3):
        if len({c_mid, c_a, c_b}) < 3:
            continue
        key = (c_mid, v_mid, c_a, v_a, c_b, v_b)
        if key in seen_ordered:
            continue
        seen_ordered.add(key)
        if solution[c_a][v_a] < solution[c_mid][v_mid] < solution[c_b][v_b]:
            clues.append({
                "type": "between_ordered",
                "args": (c_mid, v_mid, c_a, v_a, c_b, v_b),
                "text": (f"{v_mid} ({c_mid}) está entre {v_a} ({c_a}) "
                         f"e {v_b} ({c_b}), nessa ordem.")
            })

    # ── Trios: between_unordered ───────────────
    seen_unordered = set()
    for pair_mid, pair_a, pair_b in itertools.combinations(all_pairs, 3):
        for (c_mid, v_mid), (c_a, v_a), (c_b, v_b) in itertools.permutations(
                [pair_mid, pair_a, pair_b], 3):
            if len({c_mid, c_a, c_b}) < 3:
                continue
            key = (c_mid, v_mid, frozenset([(c_a, v_a), (c_b, v_b)]))
            if key in seen_unordered:
                continue
            seen_unordered.add(key)
            pm = solution[c_mid][v_mid]
            pa = solution[c_a][v_a]
            pb = solution[c_b][v_b]
            if min(pa, pb) < pm < max(pa, pb):
                clues.append({
                    "type": "between_unordered",
                    "args": (c_mid, v_mid, c_a, v_a, c_b, v_b),
                    "text": (f"{v_mid} ({c_mid}) está entre {v_a} ({c_a}) "
                             f"e {v_b} ({c_b}) (qualquer ordem).")
                })

    return clues


# ─────────────────────────────────────────────
#  Passo 3 + 4 — Greedy + Poda
# ─────────────────────────────────────────────

def count_solutions(puzzle: Puzzle, clues: list[dict], limit: int = 2) -> int:
    m = EinsteinModel(puzzle)
    m.apply_clues(clues)
    return m.count_solutions(limit)


def find_minimal_clue_set(puzzle: Puzzle, all_clues: list[dict],
                          rng: random.Random) -> list[dict] | None:
    """
    Greedy shuffle: percorre dicas em ordem aleatória,
    mantém apenas as que não tornam o sistema inconsistente,
    para quando atingir solução única.
    Depois poda todas as redundâncias iterativamente.
    """
    shuffled = all_clues.copy()
    rng.shuffle(shuffled)

    selected = []
    for clue in shuffled:
        candidate = selected + [clue]
        n = count_solutions(puzzle, candidate, limit=2)
        if n == 0:
            continue      # inconsistente, descarta
        selected = candidate
        if n == 1:
            break         # solução única atingida

    if count_solutions(puzzle, selected, limit=2) != 1:
        return None       # não convergiu (improvável com pool completo)

    # Poda iterativa
    pruned = selected.copy()
    changed = True
    while changed:
        changed = False
        for clue in pruned.copy():
            without = [c for c in pruned if c is not clue]
            if count_solutions(puzzle, without, limit=2) == 1:
                pruned = without
                changed = True
                break

    return pruned


def difficulty(clues: list[dict]) -> str:
    direct = sum(1 for c in clues if c["type"] in ("same", "at_position"))
    ratio  = direct / len(clues) if clues else 0
    if ratio >= 0.4:  return "Fácil"
    if ratio >= 0.2:  return "Médio"
    return "Difícil"


# ─────────────────────────────────────────────
#  Categorias — modifique à vontade
# ─────────────────────────────────────────────

CATEGORIES = {
    "Cor":     ["Branca", "Vermelha", "Amarela", "Verde", "Azul"],
    "Pessoa":  ["Ana", "Bruno", "Carlos", "Diana", "Eduardo"],
    "Animal":  ["Gato", "Cachorro", "Peixe", "Pássaro", "Coelho"],
    "Bebida":  ["Café", "Chá", "Leite", "Suco", "Água"],
    "Esporte": ["Futebol", "Tênis", "Natação", "Basquete", "Corrida"],
}

# ─────────────────────────────────────────────
#  Main
# ─────────────────────────────────────────────

if __name__ == "__main__":
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else random.randint(0, 9999)
    print(f"Seed: {seed}")
    rng = random.Random(seed)
    n = 5

    print(f"\nGerando solução aleatória...")
    sol = random_solution(CATEGORIES, n, rng)
    puzzle = Puzzle(n=n, categories=CATEGORIES)

    print("Solução (escondida do jogador):")
    print_solution(sol, n, CATEGORIES)

    print("\nGerando todas as dicas possíveis...")
    all_clues = generate_all_clues(sol, CATEGORIES, n)
    print(f"  Total: {len(all_clues)} dicas verdadeiras para essa solução")

    print("\nEncontrando subconjunto mínimo...")
    minimal = find_minimal_clue_set(puzzle, all_clues, rng)

    if minimal is None:
        print("Não convergiu com esse seed. Tente outro.")
        sys.exit(1)

    diff = difficulty(minimal)
    print(f"\n{'─'*60}")
    print(f"PUZZLE GERADO  |  {len(minimal)} dicas  |  Dificuldade: {diff}")
    print(f"{'─'*60}")
    for i, c in enumerate(minimal, 1):
        print(f"  {i:2}. {c['text']}")

    print(f"\n{'─'*60}")
    print("Verificação final de unicidade...")
    assert count_solutions(puzzle, minimal, limit=2) == 1
    print("✓ Solução única confirmada.")
