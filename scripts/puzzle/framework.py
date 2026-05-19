"""
Einstein's Riddle — framework com OR-Tools CP-SAT
Cobre: modelagem, tipos de restrição, solver e verificação de unicidade.
"""

from ortools.sat.python import cp_model
from dataclasses import dataclass, field
from typing import Any
import itertools
import random


@dataclass
class Puzzle:
    n: int
    categories: dict[str, list[str]]
    clues: list[dict] = field(default_factory=list)

    def cat(self, category: str, value: str) -> tuple[str, str]:
        return (category, value)


class EinsteinModel:
    """
    Cria variáveis e restrições no CP-SAT.

    Variável central:
    pos[categoria][valor] ∈ {0, 1, ..., n-1}
    = a posição (0-indexed) do valor nessa categoria.

    AllDifferent por categoria garante bijeção.
    """

    def __init__(self, puzzle: Puzzle):
        self.puzzle = puzzle
        self.model = cp_model.CpModel()
        self.n = puzzle.n
        self._build_vars()
        self._add_alldiff()

    def _build_vars(self):
        self.pos = {}
        for cat, values in self.puzzle.categories.items():
            self.pos[cat] = {}
            for v in values:
                self.pos[cat][v] = self.model.new_int_var(0, self.n - 1, f"{cat}_{v}")

    def _add_alldiff(self):
        for cat, vars_ in self.pos.items():
            self.model.add_all_different(vars_.values())

    def same_position(self, cat1, val1, cat2, val2):
        self.model.add(self.pos[cat1][val1] == self.pos[cat2][val2])

    def exact_left(self, cat1, val1, cat2, val2):
        self.model.add(self.pos[cat1][val1] == self.pos[cat2][val2] - 1)

    def somewhere_left(self, cat1, val1, cat2, val2):
        self.model.add(self.pos[cat1][val1] < self.pos[cat2][val2])

    def neighbor(self, cat1, val1, cat2, val2):
        diff = self.model.new_int_var(-(self.n-1), self.n-1, "")
        self.model.add(diff == self.pos[cat1][val1] - self.pos[cat2][val2])
        abs_diff = self.model.new_int_var(0, self.n-1, "")
        self.model.add_abs_equality(abs_diff, diff)
        self.model.add(abs_diff == 1)

    def at_position(self, cat, val, pos: int):
        self.model.add(self.pos[cat][val] == pos - 1)

    def at_end(self, cat, val):
        b = self.model.new_bool_var("")
        self.model.add(self.pos[cat][val] == 0).only_enforce_if(b)
        self.model.add(self.pos[cat][val] == self.n - 1).only_enforce_if(b.negated())

    def between_ordered(self, cat_mid, val_mid, cat_left, val_left, cat_right, val_right):
        self.model.add(self.pos[cat_left][val_left] < self.pos[cat_mid][val_mid])
        self.model.add(self.pos[cat_mid][val_mid] < self.pos[cat_right][val_right])

    def between_unordered(self, cat_mid, val_mid, cat_a, val_a, cat_b, val_b):
        b = self.model.new_bool_var("")
        self.model.add(self.pos[cat_a][val_a] < self.pos[cat_mid][val_mid]).only_enforce_if(b)
        self.model.add(self.pos[cat_mid][val_mid] < self.pos[cat_b][val_b]).only_enforce_if(b)
        self.model.add(self.pos[cat_b][val_b] < self.pos[cat_mid][val_mid]).only_enforce_if(b.negated())
        self.model.add(self.pos[cat_mid][val_mid] < self.pos[cat_a][val_a]).only_enforce_if(b.negated())

    def apply_clues(self, clues: list[dict]):
        dispatch = {
            "same": lambda c: self.same_position(*c["args"]),
            "exact_left": lambda c: self.exact_left(*c["args"]),
            "somewhere_left": lambda c: self.somewhere_left(*c["args"]),
            "neighbor": lambda c: self.neighbor(*c["args"]),
            "at_position": lambda c: self.at_position(*c["args"]),
            "at_end": lambda c: self.at_end(*c["args"]),
            "between_ordered": lambda c: self.between_ordered(*c["args"]),
            "between_unordered":lambda c: self.between_unordered(*c["args"]),
        }
        for clue in clues:
            dispatch[clue["type"]](clue)

    def solve(self) -> dict | None:
        solver = cp_model.CpSolver()
        status = solver.solve(self.model)
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return self._extract(solver)
        return None

    def count_solutions(self, limit=2) -> int:
        solver = cp_model.CpSolver()
        solver.parameters.enumerate_all_solutions = True
        counter = _SolutionCounter(limit)
        solver.solve(self.model, counter)
        return counter.count

    def _extract(self, solver) -> dict:
        result = {}
        for cat, vars_ in self.pos.items():
            result[cat] = {}
            for val, var in vars_.items():
                result[cat][val] = solver.value(var)
        return result


class _SolutionCounter(cp_model.CpSolverSolutionCallback):
    def __init__(self, limit):
        super().__init__()
        self.count = 0
        self.limit = limit
    def on_solution_callback(self):
        self.count += 1
        if self.count >= self.limit:
            self.stop_search()


def print_solution(solution: dict, n: int, categories: dict):
    col_w = 14
    header = f"{'Posição':^{col_w}}" + "".join(f"{cat:^{col_w}}" for cat in categories)
    print(header)
    print("─" * len(header))
    for pos in range(n):
        row = f"{pos+1:^{col_w}}"
        for cat, values in categories.items():
            val = next(v for v, p in solution[cat].items() if p == pos)
            row += f"{val:^{col_w}}"
        print(row)
