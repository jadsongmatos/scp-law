// Parse the puzzle that is EMBEDDED (as PT-BR text) in the shipped
// src/game_data.json back into a structured form, so the independent CSP
// solver in puzzleSolver.ts can verify the shipped game is 100% solvable.
//
// Three sources inside game_data.json:
//  - puzzle_deduction_terminal : the 5 positions + the 5 category value lists
//  - puzzle_solution_terminal  : the declared solution (the envelope)
//  - puzzle_hint_*             : the 18 hint sentences (+ "[Tipo de restrição:]")
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

function listAfter(lines: string[], label: RegExp): string[] {
  const line = lines.find((l) => label.test(l));
  if (!line) throw new Error(`game_data puzzle: missing line for ${label}`);
  return line.replace(label, '').split(',').map((s) => s.trim()).filter(Boolean);
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

function parseCategoriesAndRooms(deductionTerminal: Interactable | undefined) {
  const lines = content(deductionTerminal);
  const rooms = listAfter(lines, /^\s*Locais:\s*/);
  const categories: Record<string, string[]> = {
    suspeito: listAfter(lines, /^\s*Suspeitos:\s*/),
    local: listAfter(lines, /^\s*Locais do crime:\s*/),
    arma: listAfter(lines, /^\s*Armas:\s*/),
    motivo: listAfter(lines, /^\s*Motivos:\s*/),
    horario: listAfter(lines, /^\s*Hor[áa]rios:\s*/),
  };
  return { rooms, categories };
}

const SOL_LABEL_TO_CAT: Record<string, string> = {
  Suspeito: 'suspeito',
  Local: 'local',
  Arma: 'arma',
  Motivo: 'motivo',
  Horario: 'horario',
  Horário: 'horario',
};

function parseSolution(solutionTerminal: Interactable | undefined, rooms: string[]): Assignment {
  const sol: Assignment = {};
  let roomIdx = -1;
  for (const raw of content(solutionTerminal)) {
    const header = raw.match(/^►\s*(.+?):\s*$/);
    if (header) {
      roomIdx = resolveRoom(header[1], rooms);
      continue;
    }
    const kv = raw.match(/^\s*(Suspeito|Local|Arma|Motivo|Hor[áa]rio):\s*(.+?)\s*$/);
    if (kv && roomIdx >= 0) {
      const cat = SOL_LABEL_TO_CAT[kv[1]];
      (sol[cat] ??= {})[kv[2].trim()] = roomIdx;
    }
  }
  return sol;
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

  const { rooms, categories } = parseCategoriesAndRooms(byId('puzzle_deduction_terminal'));
  const solution = parseSolution(byId('puzzle_solution_terminal'), rooms);

  const hints = its
    .filter((i) => /^puzzle_hint_\d+$/.test(i.id))
    .sort((a, b) => Number(a.id.split('_')[2]) - Number(b.id.split('_')[2]))
    .map((i) => parseHint(content(i), rooms));

  return { categories, rooms, solution, hints, nRooms: rooms.length };
}
