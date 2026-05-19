import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { solvePuzzle, type Assignment } from './puzzleSolver';
import { loadGameDataPuzzle } from './gameDataPuzzle';

// Closes the gap: prove the SHIPPED artifact (src/game_data.json) is itself
// 100% solvable by deduction and consistent with the game's win condition.
// We parse the 18 embedded hint texts back into constraints, re-solve with
// our independent CSP solver, and require a unique solution equal both to the
// envelope (puzzle_solution_terminal) and to App.tsx's DEDUCTION_SOLUTION.

const gameData = JSON.parse(
  readFileSync(fileURLToPath(new URL('../game_data.json', import.meta.url)), 'utf-8'),
);

// Mirror of src/App.tsx DEDUCTION_LOCATIONS + DEDUCTION_SOLUTION (the actual
// win condition at App.tsx:1378). Position index = order in this list.
const APP_LOCATIONS = [
  'Escritório Murphy',
  'Rua Sieben',
  'Gasthof Vila Nova',
  'Volksschule',
  'Volkspolizeistation 8º',
];
// keyed [location][category]=value ; category key `local` mirrors App `local_crime`.
const APP_SOLUTION: Record<string, Record<string, string>> = {
  'Escritório Murphy': { suspeito: 'Dra. Cunha', local: 'Gasthof Vila Nova', arma: 'Chave Inglesa', motivo: 'Extorsão', horario: '04:00' },
  'Rua Sieben': { suspeito: 'Zeca do Gasthof', local: 'Volkspolizeistation 8º', arma: 'Arame de Piano', motivo: 'Tráfico de Crianças', horario: '02:30' },
  'Gasthof Vila Nova': { suspeito: 'Seu Jonas', local: 'Volksschule Vila Nova', arma: 'Faca de Cozinha', motivo: 'Vingança Pessoal', horario: '01:00' },
  'Volksschule': { suspeito: 'Diretora Elvira', local: 'Beco da Rua Sieben', arma: 'Revólver .38', motivo: 'Dívida de Jogo', horario: '23:30' },
  'Volkspolizeistation 8º': { suspeito: 'Kommissar Mendes', local: 'Lagerhaus 7', arma: 'Veneno Injetável', motivo: 'Cobertura de Crime', horario: '22:00' },
};

function appSolutionAsAssignment(): Assignment {
  const a: Assignment = {};
  APP_LOCATIONS.forEach((loc, idx) => {
    for (const [cat, val] of Object.entries(APP_SOLUTION[loc])) {
      (a[cat] ??= {})[val] = idx;
    }
  });
  return a;
}

describe('src/game_data.json — shipped puzzle is 100% solvable', () => {
  const puzzle = loadGameDataPuzzle(gameData);

  it('parses 18 hints and a coherent 5x5 schema', () => {
    expect(puzzle.hints).toHaveLength(18);
    expect(puzzle.nRooms).toBe(5);
    expect(Object.keys(puzzle.categories).sort()).toEqual(['arma', 'horario', 'local', 'motivo', 'suspeito']);
    for (const vals of Object.values(puzzle.categories)) expect(vals).toHaveLength(5);
  });

  it('the envelope solution matches App.tsx DEDUCTION_SOLUTION', () => {
    expect(puzzle.solution).toEqual(appSolutionAsAssignment());
  });

  it('the 18 hints entail a UNIQUE solution = the win condition', () => {
    const sols = solvePuzzle(puzzle.categories, puzzle.hints, puzzle.nRooms, 2);
    expect(sols).toHaveLength(1);
    expect(sols[0]).toEqual(puzzle.solution);
    expect(sols[0]).toEqual(appSolutionAsAssignment());
  });
});
