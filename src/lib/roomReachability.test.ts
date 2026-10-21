// Reachability test: every room that holds puzzle hints, items needed to
// finish the game, or interview clues must be reachable from rua_chuva
// following travel-type interactables. Gated edges (requiredItem items and
// the escola_fachada gate that requires visiting casa_mae first) are
// re-evaluated to a fixed point, mirroring how App.tsx handleInteract
// re-checks the gate on every interaction attempt.
//
// TDD guard for the 12-room design documented in AGENTS.md:
// casa_mae, igreja, fazenda, hospital must exist and connect.

import { describe, it, expect } from 'vitest';
import gameData from '../game_data.json';

interface Interactable {
  id: string;
  type: string;
  targetRoom?: string;
  requiredItem?: string;
  pickupItem?: string;
}

const rooms = gameData.GAME_ROOMS as Record<string, { interactables: Interactable[] }>;

function travelTargetsOf(roomId: string): Interactable[] {
  return (rooms[roomId]?.interactables ?? []).filter((o) => o.type === 'travel' && !!o.targetRoom);
}

/** Items obtainable as pickups anywhere (plus the starting isqueiro). */
function openableItems(): Set<string> {
  const s = new Set<string>(['isqueiro']);
  for (const o of Object.values(rooms).flatMap((r) => r.interactables ?? [])) {
    if (o.type === 'pickup' && o.pickupItem) s.add(o.pickupItem);
  }
  return s;
}

/**
 * Fixed-point reachability from rua_chuva. The escola_fachada gate
 * (App.tsx handleInteract) blocks entering the school until casa_mae was
 * visited, and travel objects with requiredItem need the item. Because the
 * player can retry edges after satisfying a gate, we iterate until no new
 * room is discovered.
 */
function reachableRooms(): Set<string> {
  const items = openableItems();
  const visited = new Set<string>(['rua_chuva']);
  let changed = true;
  while (changed) {
    changed = false;
    for (const rid of [...visited]) {
      for (const t of travelTargetsOf(rid)) {
        const gateBlocks = t.id === 'escola_fachada' && !visited.has('casa_mae');
        const itemBlocks = !!t.requiredItem && !items.has(t.requiredItem);
        if (gateBlocks || itemBlocks) continue;
        const tgt = t.targetRoom!;
        if (!visited.has(tgt)) { visited.add(tgt); changed = true; }
      }
    }
  }
  return visited;
}

describe('room graph reachability — the 12-room design', () => {
  it('all 12 documented rooms exist in game_data.json', () => {
    const expected = [
      'escritorio', 'rua_chuva', 'bar', 'escola', 'diretoria', 'delegacia',
      'beco', 'armazem', 'igreja', 'fazenda', 'hospital', 'casa_mae',
    ];
    for (const rid of expected) expect(rooms[rid], `missing room ${rid}`).toBeDefined();
  });

  it('every room is reachable from rua_chuva following travel objects', () => {
    const visited = reachableRooms();
    const missing = Object.keys(rooms).filter((r) => !visited.has(r));
    expect(missing, `unreachable rooms: ${missing.join(', ')}`).toEqual([]);
  });

  it('all interview clues and pickups live in reachable rooms', () => {
    const visited = reachableRooms();
    expect(visited.has('casa_mae'), 'escola gate requires casa_mae to be visitable').toBe(true);

    const content: string[] = [];
    const pickupRooms = new Set<string>();
    for (const [rid, room] of Object.entries(rooms)) {
      for (const o of room.interactables ?? []) {
        if (o.id.startsWith('interview_clue_')) content.push(`${rid}:${o.id}`);
        if (o.type === 'pickup' && o.pickupItem) pickupRooms.add(rid);
      }
    }
    const unreachable = content.filter((hc) => !visited.has(hc.split(':')[0]));
    expect(unreachable, `unreachable content: ${unreachable.join(', ')}`).toEqual([]);
    const unreachablePickupRooms = [...pickupRooms].filter((r) => !visited.has(r));
    expect(unreachablePickupRooms).toEqual([]);
  });

  it('every phone_call encounter has a matching PHONE_CONTACTS entry', () => {
    const contacts = gameData.PHONE_CONTACTS as Record<string, any>;
    for (const o of Object.values(rooms).flatMap((r) => r.interactables ?? [])) {
      if (o.type === 'phone_call' && o.id !== 'telefone_escritorio' && o.id !== 'cabine_telefone') {
        // these two are the escritorio/bar agenda phones (no direct call id semantics)
        if ('phoneCallId' in o && o.phoneCallId) {
          expect(contacts[o.phoneCallId as string], `contact ${o.phoneCallId} missing in PHONE_CONTACTS`).toBeDefined();
        }
      }
    }
  });
});
