// Parse the puzzle that is EMBEDDED (as PT-BR text) in the shipped
// src/game_data.json back into a structured form, so the independent CSP
// solver in puzzleSolver.ts can verify the shipped game is 100% solvable.
//
// Two sources inside game_data.json (the 5x5 deduction grid UI was removed —
// the schema now derives from the envelope itself, which stays the narrative
// ground truth of the case):
//  - puzzle_solution_terminal : the declared solution (the envelope LÖSUNG) —
//                               also the 5 positions + the 5 category values
//  - puzzle_hint_*            : the 18 hint sentences (+ "[Tipo de restrição:]")
//  - interview_clue_*         : the 5 interview clue constraints
//
// The hint sentence templates come from enumerate_all_hints() in
// scripts/puzzle/noir_generator.py and are deterministic; category values are
// always single-quoted, which makes extraction unambiguous.

import type { Assignment, Hint } from './puzzleSolver';

const CAT_KW = 'suspeito|local|arma|motivo|horario';

interface Interactable {
  id: string;
  documentData?: { content?: string[] };
}
interface GameData {
  GAME_ROOMS: Record<string, { interactables?: Interactable[] }>;
}

export interface ParsedPuzzle {
  categories: Record<string, string[]>;
  rooms: string[]; // ordered; index = position
  solution: Assignment;
  hints: Hint[];
  nRooms: number;
}

function allInteractables(gd: GameData): Interactable[] {
  return Object.values(gd.GAME_ROOMS).flatMap((r) => r.interactables ?? []);
}

function content(it: Interactable | undefined): string[] {
  return it?.documentData?.content ?? [];
}


const SOL_LABEL_TO_CAT: Record<string, string> = {
  Suspeito: 'suspeito',
  Local: 'local',
  Arma: 'arma',
  Motivo: 'motivo',
  Horario: 'horario',
  Horário: 'horario',
};

/**
 * Parses the envelope LÖSUNG (puzzle_solution_terminal): each "► Room:" block
 * contributes one position and one value per category, so the envelope itself
 * carries the full 5x5 schema (positions + category domains) plus the
 * declared solution — no separate deduction terminal is needed.
 */
function parseSchemaAndSolution(solutionTerminal: Interactable | undefined): { rooms: string[]; categories: Record<string, string[]>; solution: Assignment } {
  const rooms: string[] = [];
  const categories: Record<string, string[]> = { suspeito: [], local: [], arma: [], motivo: [], horario: [] };
  const sol: Assignment = {};
  let roomIdx = -1;
  for (const raw of content(solutionTerminal)) {
    const header = raw.match(/^►\s*(.+?):\s*$/);
    if (header) {
      roomIdx = rooms.push(header[1].trim()) - 1;
      continue;
    }
    const kv = raw.match(/^\s*(Suspeito|Local|Arma|Motivo|Hor[áa]rio):\s*(.+?)\s*$/);
    if (kv && roomIdx >= 0) {
      const cat = SOL_LABEL_TO_CAT[kv[1]];
      const val = kv[2].trim();
      (sol[cat] ??= {})[val] = roomIdx;
      if (!categories[cat].includes(val)) categories[cat].push(val);
    }
  }
  return { rooms, categories, solution: sol };
}

/** Resolve a (possibly verbose) room label to its position index. */
function resolveRoom(label: string, rooms: string[]): number {
  const t = label.trim().replace(/\.$/, '').trim();
  const exact = rooms.indexOf(t);
  if (exact >= 0) return exact;
  // Tolerant: shipped exact-hint uses "Volksschule Vila Nova" while the
  // canonical position is "Volksschule". Accept prefix either way, but only
  // if the match is unique (otherwise surface the ambiguity).
  const cand = rooms
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => t.startsWith(r) || r.startsWith(t));
  if (cand.length === 1) return cand[0].i;
  throw new Error(`game_data puzzle: cannot resolve room "${label}" against ${JSON.stringify(rooms)}`);
}

function parseHint(lines: string[], rooms: string[]): Hint {
  const joined = lines.join('\n');
  const typeM = joined.match(/\[Tipo de restri[çc][ãa]o:\s*([a-z_]+)\]/);
  if (!typeM) throw new Error(`game_data puzzle: hint without type tag: ${joined}`);
  const type = typeM[1];
  const sentence = lines.find((l) => new RegExp(`^O\\s+(${CAT_KW})\\s`).test(l.trim()));
  if (!sentence) throw new Error(`game_data puzzle: hint without sentence: ${joined}`);

  const pairs = [...sentence.matchAll(new RegExp(`(${CAT_KW})\\s+'([^']+)'`, 'g'))]
    .map((m) => ({ cat: m[1], val: m[2] }));

  if (type === 'exact' || type === 'not_exact') {
    const roomM = sentence.match(/est[áa] no (.+?)\.\s*$/);
    if (!roomM || pairs.length < 1) throw new Error(`game_data puzzle: bad exact hint: ${sentence}`);
    return { type, cat: pairs[0].cat, val: pairs[0].val, room: resolveRoom(roomM[1], rooms) };
  }
  if (type === 'between_ordered' || type === 'between_unordered') {
    if (pairs.length < 3) throw new Error(`game_data puzzle: bad between hint: ${sentence}`);
    return {
      type,
      c_mid: pairs[0].cat, v_mid: pairs[0].val,
      c1: pairs[1].cat, v1: pairs[1].val,
      c2: pairs[2].cat, v2: pairs[2].val,
    };
  }
  // same_room, not_same_room, adjacent, not_adjacent, left_of
  if (pairs.length < 2) throw new Error(`game_data puzzle: bad pair hint: ${sentence}`);
  return { type, c1: pairs[0].cat, v1: pairs[0].val, c2: pairs[1].cat, v2: pairs[1].val };
}

export function loadGameDataPuzzle(gd: GameData): ParsedPuzzle {
  const its = allInteractables(gd);
  const byId = (id: string) => its.find((i) => i.id === id);

  const { rooms, categories, solution } = parseSchemaAndSolution(byId('puzzle_solution_terminal'));

  const hints = its
    .filter((i) => /^(puzzle_hint_\d+|interview_clue_)/.test(i.id))
    .sort((a, b) => {
      const aNum = a.id.startsWith('puzzle') ? parseInt(a.id.split('_')[2]) : 100 + (a.id.split('_')[2]?.charCodeAt(0) || 0);
      const bNum = b.id.startsWith('puzzle') ? parseInt(b.id.split('_')[2]) : 100 + (b.id.split('_')[2]?.charCodeAt(0) || 0);
      return aNum - bNum;
    })
    .map((i) => parseHint(content(i), rooms));

  return { categories, rooms, solution, hints, nRooms: rooms.length };
}
