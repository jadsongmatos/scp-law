"""
Template 1 — Acampamento de Férias (Rachacuca)
Exatamente o puzzle que resolvemos, modelado com o framework.
"""

from scripts.puzzle.framework import Puzzle, EinsteinModel, print_solution

CATEGORIES = {
    "Barraca": ["Branca", "Vermelha", "Amarela", "Verde", "Azul"],
    "Nome": ["Anderson", "Rui", "Breno", "Gabriel", "Marco"],
    "Idade": ["9anos", "10anos", "11anos", "12anos", "13anos"],
    "Sanduíche":["Presunto", "Queijo", "Salame", "Atum", "Frango"],
    "Equipe": ["Rocket", "Dragão", "Ciclanos", "Alfafas", "Tupis"],
    "Esporte": ["Natação", "Futebol", "Tênis", "Basquete", "Corrida"],
}

CLUES = [
    {"type": "between_ordered",
     "args": ("Barraca","Vermelha", "Idade","13anos", "Esporte","Basquete"),
     "text": "A barraca Vermelha está entre o mais velho e quem gosta de Basquete, nessa ordem."},
    {"type": "neighbor",
     "args": ("Sanduíche","Salame", "Barraca","Verde"),
     "text": "O menino que gosta de Salame está ao lado de quem está na barraca Verde."},
    {"type": "exact_left",
     "args": ("Esporte","Tênis", "Barraca","Verde"),
     "text": "O garoto que joga Tênis está exatamente à esquerda de quem está na barraca Verde."},
    {"type": "somewhere_left",
     "args": ("Barraca","Vermelha", "Nome","Breno"),
     "text": "Breno está em algum lugar à direita da barraca Vermelha."},
    {"type": "at_position",
     "args": ("Esporte","Natação", 1),
     "text": "Na primeira barraca está o garoto que gosta de Natação."},
    {"type": "somewhere_left",
     "args": ("Barraca","Verde", "Idade","9anos"),
     "text": "O menino de 9 anos está em algum lugar à direita da barraca Verde."},
    {"type": "somewhere_left",
     "args": ("Barraca","Vermelha", "Esporte","Basquete"),
     "text": "A barraca Vermelha está em algum lugar à esquerda de quem gosta de Basquete."},
    {"type": "same",
     "args": ("Barraca","Verde", "Sanduíche","Atum"),
     "text": "O garoto da barraca Verde gosta de sanduíche de Atum."},
    {"type": "neighbor",
     "args": ("Nome","Gabriel", "Sanduíche","Frango"),
     "text": "Gabriel está ao lado do menino que gosta de sanduíche de Frango."},
    {"type": "somewhere_left",
     "args": ("Barraca","Vermelha", "Idade","10anos"),
     "text": "O menino de 10 anos está em algum lugar à direita da barraca Vermelha."},
    {"type": "exact_left",
     "args": ("Equipe","Rocket", "Nome","Rui"),
     "text": "O garoto da equipe Rocket está exatamente à esquerda de Rui."},
    {"type": "at_end",
     "args": ("Equipe","Tupis"),
     "text": "O garoto da equipe Tupis está em uma das pontas."},
    {"type": "somewhere_left",
     "args": ("Barraca","Amarela", "Nome","Marco"),
     "text": "A barraca Amarela está em algum lugar à esquerda de Marco."},
    {"type": "neighbor",
     "args": ("Equipe","Dragão", "Esporte","Tênis"),
     "text": "O menino da equipe Dragão está ao lado de quem gosta de jogar Tênis."},
    {"type": "between_ordered",
     "args": ("Equipe","Dragão", "Barraca","Branca", "Sanduíche","Salame"),
     "text": "O menino da equipe Dragão está entre a barraca Branca e quem gosta de Salame, nessa ordem."},
    {"type": "somewhere_left",
     "args": ("Barraca","Verde", "Sanduíche","Frango"),
     "text": "Quem gosta de Frango está em algum lugar à direita da barraca Verde."},
    {"type": "somewhere_left",
     "args": ("Barraca","Amarela", "Idade","12anos"),
     "text": "A barraca Amarela está em algum lugar à esquerda do garoto de 12 anos."},
    {"type": "neighbor",
     "args": ("Esporte","Futebol", "Equipe","Ciclanos"),
     "text": "O menino que gosta de Futebol está ao lado do menino da equipe Ciclanos."},
    {"type": "between_unordered",
     "args": ("Barraca","Vermelha", "Sanduíche","Presunto", "Idade","12anos"),
     "text": "A barraca Vermelha está entre quem gosta de Presunto e quem tem 12 anos."},
    {"type": "exact_left",
     "args": ("Equipe","Rocket", "Esporte","Futebol"),
     "text": "O garoto da equipe Rocket está exatamente à esquerda de quem gosta de Futebol."},
]


def main():
    puzzle = Puzzle(n=5, categories=CATEGORIES, clues=CLUES)
    m = EinsteinModel(puzzle)
    m.apply_clues(CLUES)

    print("Verificando unicidade...")
    n_sol = m.count_solutions(limit=2)
    print(f" Número de soluções: {n_sol}")
    assert n_sol == 1, "Puzzle ambíguo!"

    sol = m.solve()
    print("\nSolução:\n")
    print_solution(sol, puzzle.n, CATEGORIES)

    print("\nDicas usadas:")
    for i, c in enumerate(CLUES, 1):
        print(f" {i:2}. {c['text']}")


if __name__ == "__main__":
    main()
