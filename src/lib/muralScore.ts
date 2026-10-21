// MURAL DE PISTAS — pontuação do mural ao fazer a denúncia.
// Funções puras (vitest em muralScore.test.ts); o App apenas liga à UI.
// Critério de bônus: grafo pistas↔fios conexo em um único componente.
import type { Clue, MuralData } from '@/components/board/data';

export const POINTS_PER_CLUE = 10;
export const POINTS_PER_CONNECTION = 5;
export const BONUS_CONNECTED = 50;
export interface MuralScore {
  clues: number;
  connections: number;
  /** Componentes conexos considerando apenas fios com as duas pontas existentes. */
  components: number;
  /** true quando há pelo menos uma pista e todas pertencem a um único componente. */
  singleComponent: boolean;
  points: number;
}

/**
 * Conta componentes conexos sobre as pistas; fios com pontas inexistentes
 * (restos de saves antigos) são ignorados, nunca quebram o cálculo.
 */
export function countComponents(clues: Clue[], connections: { from: string; to: string }[]): number {
  const ids = new Set(clues.map(c => c.id));
  const adjacency = new Map<string, string[]>(clues.map(c => [c.id, []]));
  for (const connection of connections) {
    if (!ids.has(connection.from) || !ids.has(connection.to)) continue;
    adjacency.get(connection.from)!.push(connection.to);
    adjacency.get(connection.to)!.push(connection.from);
  }
  const visited = new Set<string>();
  let components = 0;
  for (const id of ids) {
    if (visited.has(id)) continue;
    components++;
    const queue = [id];
    while (queue.length) {
      const current = queue.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) queue.push(next);
      }
    }
  }
  return components;
}

export function scoreMural(mural: MuralData): MuralScore {
  const clues = mural.clues.length;
  const connections = mural.connections.length;
  const components = clues === 0 ? 0 : countComponents(mural.clues, mural.connections);
  // O bônus premia LIGAR pistas: exige um grafo de fato conectável (≥2
  // pistas em um único componente) — uma pista sozinha é trivialmente
  // "conexa" e não recompensa investigação alguma.
  const singleComponent = clues >= 2 && components === 1;
  const points = clues * POINTS_PER_CLUE + connections * POINTS_PER_CONNECTION + (singleComponent ? BONUS_CONNECTED : 0);
  return { clues, connections, components, singleComponent, points };
}

/**
 * A denúncia exige a decisão de conexão: todas as pistas descobertas
 * (≥2) amarradas em um único grafo. O jogador decide quais informações
 * dos depoimentos serão conectadas no quadro antes de fechar o caso —
 * mesmo critério do bônus de grafo conexo.
 */
export function canAccuse(score: MuralScore): boolean {
  return score.singleComponent;
}
