import { describe, expect, it } from 'vitest';
import { BONUS_CONNECTED, POINTS_PER_CLUE, POINTS_PER_CONNECTION, countComponents, scoreMural, type MuralScore } from './muralScore';
import type { Clue, MuralData } from '@/components/board/data';

function clue(id: string): Clue {
  return { id, type: 'note', title: id, subtitle: '', content: '', x: 0, y: 0, width: 200, height: 200, rotation: 0, tags: [], createdAt: '2026-10-20T00:00:00.000Z' };
}

function wire(from: string, to: string) {
  return { id: `${from}-${to}`, from, to, label: 'Relacionado a', color: '#a13d35' };
}

function mural(clues: string[], connections: [string, string][]): MuralData {
  return { clues: clues.map(clue), connections: connections.map(([f, t]) => wire(f, t)) };
}

describe('countComponents', () => {
  it('retorna 0 para mural vazio', () => {
    expect(countComponents([], [])).toBe(0);
  });

  it('conta pistas soltas como componentes isolados', () => {
    expect(countComponents([clue('a'), clue('b'), clue('c')], [])).toBe(3);
  });

  it('une pistas ligadas no mesmo componente', () => {
    expect(countComponents([clue('a'), clue('b')], [wire('a', 'b')])).toBe(1);
  });

  it('forma dois componentes quando os grupos não se tocam', () => {
    const data = mural(['a', 'b', 'c', 'd'], [['a', 'b'], ['c', 'd']]);
    expect(countComponents(data.clues, data.connections)).toBe(2);
  });

  it('um fio em ponte fecha o grafo em um único componente', () => {
    const data = mural(['a', 'b', 'c', 'd'], [['a', 'b'], ['c', 'd'], ['b', 'c']]);
    expect(countComponents(data.clues, data.connections)).toBe(1);
  });

  it('ignora fios com pontas inexistentes', () => {
    expect(countComponents([clue('a')], [wire('a', 'fantasma'), wire('fantasma', 'outro')])).toBe(1);
  });

  it('ignora laços e fios duplicados', () => {
    expect(countComponents([clue('a')], [wire('a', 'a'), wire('a', 'a')])).toBe(1);
  });
});

describe('scoreMural', () => {
  it('mural vazio vale 0 pontos sem bônus', () => {
    const score = scoreMural({ clues: [], connections: [] });
    expect(score).toEqual<MuralScore>({ clues: 0, connections: 0, components: 0, singleComponent: false, points: 0 });
  });

  it('uma pista sozinha vale 10 (o bônus exige pistas conectadas)', () => {
    const score = scoreMural(mural(['a'], []));
    expect(score.points).toBe(10);
    expect(score.singleComponent).toBe(false);
  });

  it('duas pistas ligadas ganham o bônus de conexão', () => {
    const score = scoreMural(mural(['a', 'b'], [['a', 'b']]));
    expect(score.points).toBe(2 * POINTS_PER_CLUE + 1 * POINTS_PER_CONNECTION + BONUS_CONNECTED);
    expect(score.singleComponent).toBe(true);
  });

  it('calcula a soma sem bônus quando há dois componentes', () => {
    const score = scoreMural(mural(['a', 'b', 'c', 'd'], [['a', 'b'], ['c', 'd']]));
    expect(score.points).toBe(4 * POINTS_PER_CLUE + 2 * POINTS_PER_CONNECTION);
    expect(score.components).toBe(2);
    expect(score.singleComponent).toBe(false);
  });

  it('fio órfão não vale pontos nem quebra o bônus', () => {
    const score = scoreMural(mural(['a', 'b'], [['a', 'b'], ['a', 'fantasma']]));
    expect(score.connections).toBe(2);
    expect(score.points).toBe(2 * POINTS_PER_CLUE + 2 * POINTS_PER_CONNECTION + BONUS_CONNECTED);
  });
});
