import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildGameDataExport, type GameDataLike } from './devExport';
import type { Room } from '../data';

const base = JSON.parse(
  readFileSync(fileURLToPath(new URL('../game_data.json', import.meta.url)), 'utf-8'),
) as GameDataLike;

/** Espelho vivo: salas do JSON + chaves de runtime que data.ts adiciona. */
function liveRooms(): Record<string, Room> {
  const rooms: Record<string, Room> = {};
  for (const [id, room] of Object.entries(base.GAME_ROOMS)) {
    rooms[id] = { ...(room as Room), bgImage: '/src/assets/fake.png', mapImage: '/src/assets/fake-map.png' };
  }
  return rooms;
}

describe('devExport — export do modo dev não apaga dados', () => {
  it('preserva todos os campos de nível superior do game_data.json', () => {
    const exported = buildGameDataExport(base, liveRooms());
    expect(Object.keys(exported).sort()).toEqual(Object.keys(base).sort());
    expect(exported.PHONE_CONTACTS).toEqual(base.PHONE_CONTACTS);
    expect(exported._interviewClueMap).toEqual(base._interviewClueMap);
    expect(exported.ITEM_NAMES).toEqual(base.ITEM_NAMES);
  });

  it('salas espelham o base campo a campo quando nada foi editado', () => {
    const exported = buildGameDataExport(base, liveRooms());
    for (const [id, room] of Object.entries(base.GAME_ROOMS)) {
      expect(exported.GAME_ROOMS[id]).toEqual(room);
    }
  });

  it('nunca serializa chaves de runtime (imagens resolvidas pelo Vite)', () => {
    const exported = buildGameDataExport(base, liveRooms());
    for (const room of Object.values(exported.GAME_ROOMS)) {
      expect(room).not.toHaveProperty('bgImage');
      expect(room).not.toHaveProperty('mapImage');
    }
  });

  it('exporta a posição editada em dev e mantém o resto do arquivo', () => {
    const rooms = liveRooms();
    const escritorio = rooms.escritorio;
    const first = escritorio.interactables[0];
    first.x = 99.5;
    first.y = 88.25;
    const exported = buildGameDataExport(base, rooms) as GameDataLike;
    const exportedFirst = (exported.GAME_ROOMS.escritorio as unknown as Room).interactables[0];
    expect(exportedFirst.x).toBe(99.5);
    expect(exportedFirst.y).toBe(88.25);
    // o restante do arquivo continua intacto
    expect(exported.PHONE_CONTACTS).toEqual(base.PHONE_CONTACTS);
  });
});
