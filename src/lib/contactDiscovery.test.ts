import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contactRevealedByItem, contactsDiscoveredAtStart, DIALOGUE_REVEALS } from './contactDiscovery';

const gameData = JSON.parse(
  readFileSync(fileURLToPath(new URL('../game_data.json', import.meta.url)), 'utf-8'),
) as {
  PHONE_CONTACTS: Record<string, { discoveredFrom?: string; dialogue?: Record<string, unknown> }>;
  GAME_ROOMS: Record<string, { interactables?: Array<{ id: string; pickupItem?: string }> }>;
};

const contacts = gameData.PHONE_CONTACTS;
const allInteractables = Object.values(gameData.GAME_ROOMS).flatMap((r) => r.interactables ?? []);

describe('contactDiscovery — todo contato tem caminho de descoberta', () => {
  it('contatos auto entram na agenda no início', () => {
    const auto = contactsDiscoveredAtStart(contacts);
    expect(auto).toEqual(expect.arrayContaining(['agente_scp', 'wohltat']));
    for (const id of auto) expect(contacts[id].discoveredFrom).toBe('auto');
  });

  it('item coletado revela o contato cujo discoveredFrom é o id do item', () => {
    expect(contactRevealedByItem(contacts, 'cartao_visita')).toBe('diretora_elvira');
    expect(contactRevealedByItem(contacts, 'item_inexistente')).toBeNull();
  });

  it('todo contato de PHONE_CONTACTS tem um gatilho implementado', () => {
    for (const [id, contact] of Object.entries(contacts)) {
      const from = contact.discoveredFrom;
      expect(from, `${id} sem discoveredFrom — nunca entra na agenda`).toBeTruthy();

      if (from === 'auto') continue; // contexto inicial da máquina

      if (from === 'zeca_reveal') {
        const cfg = DIALOGUE_REVEALS[id];
        expect(cfg, `${id} zeca_reveal sem nó mapeado em DIALOGUE_REVEALS`).toBeTruthy();
        const speaker = contacts[cfg!.speakerId];
        expect(
          speaker?.dialogue?.[cfg!.nodeId],
          `nó ${cfg!.nodeId} inexistente no diálogo de ${cfg!.speakerId}`,
        ).toBeTruthy();
        continue;
      }

      const hasTrigger = allInteractables.some(
        (o) => o.id === from || o.pickupItem === from,
      );
      expect(
        hasTrigger,
        `gatilho "${from}" de ${id} não existe em nenhuma sala`,
      ).toBe(true);
    }
  });
});
