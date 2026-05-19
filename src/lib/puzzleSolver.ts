// Independent CSP solver for the noir Einstein puzzle produced by
// scripts/puzzle/noir_generator.py (--output puzzle_output.json).
//
// Model: there are `nRooms` ordered positions (0..nRooms-1). Every category
// (suspeito, local, arma, motivo, horario) assigns each of its values to a
// distinct position. Hints constrain those positions. Constraint semantics
// mirror `_make_constraint_for_hint` in the generator EXACTLY so that this
// solver is a true independent check, not a restatement of the generator.

/** Solution shape: assignment[category][value] = positionIndex. */
export type Assignment = Record<string, Record<string, number>>;

export interface Hint {
  type: string;
  // exact / not_exact
  cat?: string;
  val?: string;
  room?: number;
  // pairwise + between endpoints
  c1?: string;
  v1?: string;
  c2?: string;
  v2?: string;
  // between middle
  c_mid?: string;
  v_mid?: string;
  text?: string;
}

type Cell = [cat: string, val: string];

function hintCells(h: Hint): Cell[] {
  switch (h.type) {
    case 'exact':
    case 'not_exact':
      return [[h.cat!, h.val!]];
    case 'between_ordered':
    case 'between_unordered':
      return [
        [h.c1!, h.v1!],
        [h.c_mid!, h.v_mid!],
        [h.c2!, h.v2!],
      ];
    default: // same_room, not_same_room, adjacent, not_adjacent, left_of
      return [
        [h.c1!, h.v1!],
        [h.c2!, h.v2!],
      ];
  }
}

/** Evaluate a hint. Only call once every cell it references is assigned. */
function satisfied(h: Hint, a: Assignment): boolean {
  const at = (c: string, v: string) => a[c][v];
  switch (h.type) {
    case 'exact':
      return at(h.cat!, h.val!) === h.room;
    case 'not_exact':
      return at(h.cat!, h.val!) !== h.room;
    case 'same_room':
      return at(h.c1!, h.v1!) === at(h.c2!, h.v2!);
    case 'not_same_room':
      return at(h.c1!, h.v1!) !== at(h.c2!, h.v2!);
    case 'adjacent':
      return Math.abs(at(h.c1!, h.v1!) - at(h.c2!, h.v2!)) === 1;
    case 'not_adjacent':
      return Math.abs(at(h.c1!, h.v1!) - at(h.c2!, h.v2!)) !== 1;
    case 'left_of':
      return at(h.c1!, h.v1!) < at(h.c2!, h.v2!);
    case 'between_ordered': {
      const p1 = at(h.c1!, h.v1!);
      const pm = at(h.c_mid!, h.v_mid!);
      const p2 = at(h.c2!, h.v2!);
      return p1 < pm && pm < p2;
    }
    case 'between_unordered': {
      const p1 = at(h.c1!, h.v1!);
      const pm = at(h.c_mid!, h.v_mid!);
      const p2 = at(h.c2!, h.v2!);
      return (p1 < pm && pm < p2) || (p2 < pm && pm < p1);
    }
    default:
      return true; // unknown constraint type → no-op (matches generator)
  }
}

/**
 * Enumerate solutions of the hint system by backtracking, stopping once
 * `maxSolutions` have been found (2 is enough to decide uniqueness).
 * Each category is an all-different assignment of its values to positions;
 * a hint is checked the moment its last referenced cell becomes bound.
 */
export function solvePuzzle(
  categories: Record<string, string[]>,
  hints: Hint[],
  nRooms: number,
  maxSolutions = 2,
): Assignment[] {
  const cats = Object.keys(categories);
  const cells: Cell[] = [];
  for (const c of cats) for (const v of categories[c]) cells.push([c, v]);

  const cellsOf = hints.map(hintCells);

  const assign: Assignment = {};
  const usedByCat: Record<string, Set<number>> = {};
  for (const c of cats) {
    assign[c] = {};
    usedByCat[c] = new Set();
  }

  const bound = (c: string, v: string) => assign[c][v] !== undefined;
  const solutions: Assignment[] = [];

  // Re-check every hint that just became fully bound by assigning (jc, jv).
  const stillConsistent = (jc: string, jv: string): boolean => {
    for (let i = 0; i < hints.length; i++) {
      const refs = cellsOf[i];
      if (!refs.some(([c, v]) => c === jc && v === jv)) continue;
      if (!refs.every(([c, v]) => bound(c, v))) continue;
      if (!satisfied(hints[i], assign)) return false;
    }
    return true;
  };

  const backtrack = (idx: number): void => {
    if (solutions.length >= maxSolutions) return;
    if (idx === cells.length) {
      const snap: Assignment = {};
      for (const c of cats) {
        snap[c] = {};
        for (const v of categories[c]) snap[c][v] = assign[c][v];
      }
      solutions.push(snap);
      return;
    }
    const [cat, val] = cells[idx];
    for (let room = 0; room < nRooms; room++) {
      if (usedByCat[cat].has(room)) continue;
      assign[cat][val] = room;
      usedByCat[cat].add(room);
      if (stillConsistent(cat, val)) backtrack(idx + 1);
      delete assign[cat][val];
      usedByCat[cat].delete(room);
      if (solutions.length >= maxSolutions) return;
    }
  };

  backtrack(0);
  return solutions;
}
