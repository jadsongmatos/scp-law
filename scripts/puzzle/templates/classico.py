"""
Template 3 — Puzzle Clássico do Einstein (versão original das 5 casas)

O alemão tem o peixe. Prove.

Categorias: Nacionalidade, Cor, Bebida, Cigarro, Animal
15 dicas originais, solução única.
"""

from scripts.puzzle.framework import Puzzle, EinsteinModel, print_solution

CATEGORIES = {
    "Cor": ["Vermelha", "Verde", "Branca", "Amarela", "Azul"],
    "Pessoa": ["Inglês", "Sueco", "Dinamarquês", "Norueguês", "Alemão"],
    "Bebida": ["Chá", "Café", "Leite", "Cerveja", "Água"],
    "Cigarro": ["PallMall", "Dunhill", "BlueMaster", "Prince", "Blends"],
    "Animal": ["Cachorro", "Pássaro", "Gato", "Cavalo", "Peixe"],
}

CLUES = [
    {"type": "same", "args": ("Pessoa","Inglês", "Cor","Vermelha"),
     "text": "O inglês mora na casa vermelha."},
    {"type": "same", "args": ("Pessoa","Sueco", "Animal","Cachorro"),
     "text": "O sueco tem cachorro."},
    {"type": "same", "args": ("Pessoa","Dinamarquês", "Bebida","Chá"),
     "text": "O dinamarquês bebe chá."},
    {"type": "exact_left", "args": ("Cor","Verde", "Cor","Branca"),
     "text": "A casa verde está exatamente à esquerda da casa branca."},
    {"type": "same", "args": ("Cor","Verde", "Bebida","Café"),
     "text": "O dono da casa verde bebe café."},
    {"type": "same", "args": ("Cigarro","PallMall", "Animal","Pássaro"),
     "text": "O fumante de PallMall cria pássaros."},
    {"type": "same", "args": ("Cor","Amarela", "Cigarro","Dunhill"),
     "text": "O dono da casa amarela fuma Dunhill."},
    {"type": "at_position", "args": ("Bebida","Leite", 3),
     "text": "O homem da casa do meio bebe leite."},
    {"type": "at_position", "args": ("Pessoa","Norueguês", 1),
     "text": "O norueguês mora na primeira casa."},
    {"type": "neighbor", "args": ("Cigarro","Blends", "Animal","Gato"),
     "text": "O fumante de Blends é vizinho do dono do gato."},
    {"type": "neighbor", "args": ("Animal","Cavalo", "Cigarro","Dunhill"),
     "text": "O dono do cavalo é vizinho do fumante de Dunhill."},
    {"type": "same", "args": ("Cigarro","BlueMaster", "Bebida","Cerveja"),
     "text": "O fumante de BlueMaster bebe cerveja."},
    {"type": "same", "args": ("Pessoa","Alemão", "Cigarro","Prince"),
     "text": "O alemão fuma Prince."},
    {"type": "neighbor", "args": ("Pessoa","Norueguês", "Cor","Azul"),
     "text": "O norueguês é vizinho da casa azul."},
    {"type": "neighbor", "args": ("Cigarro","Blends", "Bebida","Água"),
     "text": "O fumante de Blends é vizinho de quem bebe água."},
]


def main():
    puzzle = Puzzle(n=5, categories=CATEGORIES, clues=CLUES)
    m = EinsteinModel(puzzle)
    m.apply_clues(CLUES)

    n_sol = m.count_solutions(limit=2)
    print(f"Soluções encontradas: {n_sol}")
    assert n_sol == 1

    sol = m.solve()
    print("\nSolução do puzzle clássico do Einstein:\n")
    print_solution(sol, puzzle.n, CATEGORIES)

    dono_peixe = next(v for v, p in sol["Pessoa"].items()
                      if p == sol["Animal"]["Peixe"])
    print(f"\nO dono do peixe é: {dono_peixe}")


if __name__ == "__main__":
    main()
