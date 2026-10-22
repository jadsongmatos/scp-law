// Export do modo dev (DevInspector). O bug P1: o export antigo montava o
// arquivo a partir de ITEM_NAMES + GAME_ROOMS com lista fixa de campos, e
// salvar o resultado por cima de game_data.json apagava PHONE_CONTACTS,
// _interviewClueMap, rain, interviewGate...
//
// Correção: partir do game_data.json EMBARCADO e sobrepô apenas o espelho
// vivo das salas (localRooms, mutado pelo editor em dev). Todo o resto do
// arquivo passa intacto. Chaves de runtime (imagens resolvidas pelo Vite,
// adicionadas por data.ts) nunca são serializadas.

import type { Room } from '../data';

const RUNTIME_ROOM_KEYS: Record<string, true> = { bgImage: true, mapImage: true };

export interface GameDataLike {
  GAME_ROOMS: Record<string, unknown>;
  [key: string]: unknown;
}

/** Serializa a sala viva: remove chaves de runtime e valores não-JSON. */
function serializeRoom(room: Room): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(room as unknown as Record<string, unknown>)) {
    if (RUNTIME_ROOM_KEYS[key]) continue;
    clean[key] = value;
  }
  return JSON.parse(JSON.stringify(clean));
}

/**
 * Export completo: preserva todos os campos de `base` (o game_data.json
 * embarcado), substituindo GAME_ROOMS pelo conteúdo das salas vivas — só
 * posições/edições feitas em dev mudam; nenhum campo de base se perde.
 */
export function buildGameDataExport(
  base: GameDataLike,
  localRooms: Record<string, Room>,
): GameDataLike {
  const exportedRooms: Record<string, unknown> = {};
  for (const [roomId, room] of Object.entries(localRooms)) {
    exportedRooms[roomId] = serializeRoom(room);
  }
  return { ...base, GAME_ROOMS: exportedRooms };
}
