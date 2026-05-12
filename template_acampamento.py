"""
Template 1 — Acampamento de Férias (Rachacuca)
Exatamente o puzzle que resolvemos, modelado com o framework.
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from puzzle import Puzzle, EinsteinModel, print_solution

# ── Definição do puzzle ──────────────────────

CATEGORIES = {
    "Barraca": ["Branca", "Vermelha", "Amarela", "Verde", "Azul"],
    "Nome":    ["Anderson", "Rui", "Breno", "Gabriel", "Marco"],
    "Idade":   ["9anos", "10anos", "11anos", "12anos", "13anos"],
    "Sanduíche":["Presunto", "Queijo", "Salame", "Atum", "Frango"],
    "Equipe":  ["Rocket", "Dragão", "Ciclanos", "Alfafas", "Tupis"],
    "Esporte": ["Natação", "Futebol", "Tênis", "Basquete", "Corrida"],
}

# Cada dica tem type + args (exatamente os parâmetros do método)
CLUES = [
    # Dica  1: Vermelha entre 13anos e Basquete (nessa ordem)
    {"type": "between_ordered",
     "args": ("Barraca","Vermelha", "Idade","13anos", "Esporte","Basquete"),
     "text": "A barraca Vermelha está entre o mais velho e quem gosta de Basquete, nessa ordem."},

    # Dica  2: Salame ao lado de Verde
    {"type": "neighbor",
     "args": ("Sanduíche","Salame", "Barraca","Verde"),
     "text": "O menino que gosta de Salame está ao lado de quem está na barraca Verde."},

    # Dica  3: Tênis exatamente à esquerda de Verde
    {"type": "exact_left",
     "args": ("Esporte","Tênis", "Barraca","Verde"),
     "text": "O garoto que joga Tênis está exatamente à esquerda de quem está na barraca Verde."},

    # Dica  4: Breno à direita de Vermelha
    {"type": "somewhere_left",
     "args": ("Barraca","Vermelha", "Nome","Breno"),
     "text": "Breno está em algum lugar à direita da barraca Vermelha."},

    # Dica  5: Posição 1 = Natação
    {"type": "at_position",
     "args": ("Esporte","Natação", 1),
     "text": "Na primeira barraca está o garoto que gosta de Natação."},

    # Dica  6: 9anos à direita de Verde
    {"type": "somewhere_left",
     "args": ("Barraca","Verde", "Idade","9anos"),
     "text": "O menino de 9 anos está em algum lugar à direita da barraca Verde."},

    # Dica  7: Vermelha à esquerda de Basquete
    {"type": "somewhere_left",
     "args": ("Barraca","Vermelha", "Esporte","Basquete"),
     "text": "A barraca Vermelha está em algum lugar à esquerda de quem gosta de Basquete."},

    # Dica  8: Verde = Atum
    {"type": "same",
     "args": ("Barraca","Verde", "Sanduíche","Atum"),
     "text": "O garoto da barraca Verde gosta de sanduíche de Atum."},

    # Dica  9: Gabriel ao lado de Frango
    {"type": "neighbor",
     "args": ("Nome","Gabriel", "Sanduíche","Frango"),
     "text": "Gabriel está ao lado do menino que gosta de sanduíche de Frango."},

    # Dica 10: 10anos à direita de Vermelha
    {"type": "somewhere_left",
     "args": ("Barraca","Vermelha", "Idade","10anos"),
     "text": "O menino de 10 anos está em algum lugar à direita da barraca Vermelha."},

    # Dica 11: Rocket exatamente à esquerda de Rui
    {"type": "exact_left",
     "args": ("Equipe","Rocket", "Nome","Rui"),
     "text": "O garoto da equipe Rocket está exatamente à esquerda de Rui."},

    # Dica 12: Tupis numa das pontas
    {"type": "at_end",
     "args": ("Equipe","Tupis"),
     "text": "O garoto da equipe Tupis está em uma das pontas."},

    # Dica 13: Amarela à esquerda de Marco
    {"type": "somewhere_left",
     "args": ("Barraca","Amarela", "Nome","Marco"),
     "text": "A barraca Amarela está em algum lugar à esquerda de Marco."},

    # Dica 14: Dragão ao lado de Tênis
    {"type": "neighbor",
     "args": ("Equipe","Dragão", "Esporte","Tênis"),
     "text": "O menino da equipe Dragão está ao lado de quem gosta de jogar Tênis."},

    # Dica 15: Branca < Dragão < Salame (nessa ordem)
    {"type": "between_ordered",
     "args": ("Equipe","Dragão", "Barraca","Branca", "Sanduíche","Salame"),
     "text": "O menino da equipe Dragão está entre a barraca Branca e quem gosta de Salame, nessa ordem."},

    # Dica 16: Frango à direita de Verde
    {"type": "somewhere_left",
     "args": ("Barraca","Verde", "Sanduíche","Frango"),
     "text": "Quem gosta de Frango está em algum lugar à direita da barraca Verde."},

    # Dica 17: Amarela à esquerda de 12anos
    {"type": "somewhere_left",
     "args": ("Barraca","Amarela", "Idade","12anos"),
     "text": "A barraca Amarela está em algum lugar à esquerda do garoto de 12 anos."},

    # Dica 18: Futebol ao lado de Ciclanos
    {"type": "neighbor",
     "args": ("Esporte","Futebol", "Equipe","Ciclanos"),
     "text": "O menino que gosta de Futebol está ao lado do menino da equipe Ciclanos."},

    # Dica 19: Vermelha entre Presunto e 12anos (qualquer ordem)
    {"type": "between_unordered",
     "args": ("Barraca","Vermelha", "Sanduíche","Presunto", "Idade","12anos"),
     "text": "A barraca Vermelha está entre quem gosta de Presunto e quem tem 12 anos."},

    # Dica 20: Rocket exatamente à esquerda de Futebol
    {"type": "exact_left",
     "args": ("Equipe","Rocket", "Esporte","Futebol"),
     "text": "O garoto da equipe Rocket está exatamente à esquerda de quem gosta de Futebol."},
]

# ── Resolver ─────────────────────────────────

if __name__ == "__main__":
    puzzle = Puzzle(n=5, categories=CATEGORIES, clues=CLUES)
    m = EinsteinModel(puzzle)
    m.apply_clues(CLUES)

    print("Verificando unicidade...")
    n_sol = m.count_solutions(limit=2)
    print(f"  Número de soluções: {n_sol}")
    assert n_sol == 1, "Puzzle ambíguo!"

    sol = m.solve()
    print("\nSolução:\n")
    print_solution(sol, puzzle.n, CATEGORIES)

    print("\nDicas usadas:")
    for i, c in enumerate(CLUES, 1):
        print(f"  {i:2}. {c['text']}")
