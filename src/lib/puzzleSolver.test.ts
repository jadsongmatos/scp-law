import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { solvePuzzle, type Assignment, type Hint } from './puzzleSolver';

// "Use the GENERATED JSON to test that it is possible to reach the end by
// solving 100% of the case." We independently re-solve the puzzle from the
// structured hints (our own TS CSP solver, not trusting the Python generator)
// and prove: the 16 hints entail exactly ONE solution, and that solution is
// exactly the declared one — i.e. a perfect reasoner wins the case.
interface PuzzleOutput {
  puzzle: {
    seed: number;
    n_rooms: number;
    categories: Record<string, string[]>;
    solution: Assignment;
    unique_solution: boolean;
  };
  hints: Hint[];
}

const puzzle: PuzzleOutput = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../puzzle_output.json', import.meta.url)), 'utf-8'),
);

describe('puzzle_output.json — solvability (100% of the case)', () => {
  it('has a coherent structured shape', () => {
    expect(puzzle.puzzle.n_rooms).toBeGreaterThanOrEqual(4);
    expect(puzzle.hints.length).toBeGreaterThan(0);
    for (const vals of Object.values(puzzle.puzzle.categories)) {
      expect(vals).toHaveLength(puzzle.puzzle.n_rooms);
    }
  });

  it('the declared solution itself satisfies every hint', () => {
    const sols = solvePuzzle(puzzle.puzzle.categories, puzzle.hints, puzzle.puzzle.n_rooms, 2);
    // The declared solution must be among the solutions of the hint system.
    expect(sols).toContainEqual(puzzle.puzzle.solution);
  });

  it('the 16 hints entail a UNIQUE solution equal to the declared one', () => {
    const sols = solvePuzzle(puzzle.puzzle.categories, puzzle.hints, puzzle.puzzle.n_rooms, 2);
    // Exactly one solution => the case is 100% solvable by deduction.
    expect(sols).toHaveLength(1);
    expect(sols[0]).toEqual(puzzle.puzzle.solution);
    // Our independent verdict must agree with the generator's own flag.
    expect(puzzle.puzzle.unique_solution).toBe(true);
  });
});
