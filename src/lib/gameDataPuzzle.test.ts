import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { solvePuzzle, isHintSatisfied } from './puzzleSolver';
import { loadGameDataPuzzle } from './gameDataPuzzle';

// O jogo não embarca mais as 18 pistas de arquivo (só os 5 depoimentos das
// entrevistas sobreviveram): o sistema dedutivo deixou de ter solução única
// por lógica — o envelope LÖSUNG (puzzle_solution_terminal) é a verdade
// canônica narrativa. O que ESTE teste ancora:
//   1. os 5 depoimentos parseiam como restrições válidas do mesmo CSP;
//   2. nenhum depoimento CONTRADIZ o envelope (consistência, não uniqueza);
//   3. sem as pistas de arquivo a solução NÃO é única (o jogador não deduz
//      o caso por lógica pura — investiga, conecta e denuncia).

const gameData = JSON.parse(
  readFileSync(fileURLToPath(new URL('../game_data.json', import.meta.url)), 'utf-8'),
);

describe('src/game_data.json — depoimentos consistentes com o envelope', () => {
  const puzzle = loadGameDataPuzzle(gameData);

  it('parseia 5 depoimentos e um schema 5x5 coerente do envelope', () => {
    expect(puzzle.hints).toHaveLength(5);
    expect(puzzle.nRooms).toBe(5);
    expect(Object.keys(puzzle.categories).sort()).toEqual(['arma', 'horario', 'local', 'motivo', 'suspeito']);
    for (const vals of Object.values(puzzle.categories)) expect(vals).toHaveLength(5);
  });

  it('a solução do envelope satisfaz todos os 5 depoimentos', () => {
    for (const h of puzzle.hints) {
      expect(isHintSatisfied(h, puzzle.solution), `depoimento violado: ${JSON.stringify(h)}`).toBe(true);
    }
  });

  it('5 depoimentos não bastam: o sistema tem muitas soluções (envelope = verdade canônica)', () => {
    const sols = solvePuzzle(puzzle.categories, puzzle.hints, puzzle.nRooms, 3);
    expect(sols.length).toBeGreaterThan(1);
  });
});
