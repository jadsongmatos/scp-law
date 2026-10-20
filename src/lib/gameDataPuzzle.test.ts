import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { solvePuzzle } from './puzzleSolver';
import { loadGameDataPuzzle } from './gameDataPuzzle';

// Closes the gap: prove the SHIPPED artifact (src/game_data.json) is itself
// 100% solvable by deduction. We parse the 18 embedded hint texts back into
// constraints and re-solve with our independent CSP solver, requiring a
// unique solution equal to the envelope (puzzle_solution_terminal). The
// envelope remains the narrative ground truth of the case even though the
// 5x5 deduction grid UI is gone — the mural + denúncia ending replaced it.

const gameData = JSON.parse(
  readFileSync(fileURLToPath(new URL('../game_data.json', import.meta.url)), 'utf-8'),
);

describe('src/game_data.json — shipped puzzle is 100% solvable', () => {
  const puzzle = loadGameDataPuzzle(gameData);

  it('parses 23 hints (18 puzzle + 5 interview clues) and a coherent 5x5 schema', () => {
    expect(puzzle.hints).toHaveLength(23);
    expect(puzzle.nRooms).toBe(5);
    expect(Object.keys(puzzle.categories).sort()).toEqual(['arma', 'horario', 'local', 'motivo', 'suspeito']);
    for (const vals of Object.values(puzzle.categories)) expect(vals).toHaveLength(5);
  });

  it('the 23 hints entail a UNIQUE solution = the envelope', () => {
    const sols = solvePuzzle(puzzle.categories, puzzle.hints, puzzle.nRooms, 2);
    expect(sols).toHaveLength(1);
    expect(sols[0]).toEqual(puzzle.solution);
  });
});
