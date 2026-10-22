// Descoberta de contatos para a agenda. O campo `discoveredFrom` de cada
// contato no game_data.json é a fonte canônica do seu caminho de descoberta:
//  - 'auto'        → na agenda desde o início (contexto inicial da máquina)
//  - 'zeca_reveal' → revelado num nó do diálogo de outro contato (DIALOGUE_REVEALS)
//  - id de item    → revelado ao coletar o item (ex.: 'cartao_visita')
//  - id de objeto  → revelado pelo objeto na sala (ex.: 'telefone_santos',
//                    'carta_jonas') — cabeado nos ramos de interação do App.

export interface DiscoverableContact {
  discoveredFrom?: string;
}

/** Contato revelado → { falante que revela, nó do diálogo em que revela }. */
export const DIALOGUE_REVEALS: Readonly<
  Record<string, { speakerId: string; nodeId: string }>
> = {
  dra_cunha: { speakerId: 'zeca', nodeId: 'zc_clue' },
};

/** Contatos que entram na agenda no início do jogo (`discoveredFrom: 'auto'`). */
export function contactsDiscoveredAtStart(
  contacts: Record<string, DiscoverableContact>,
): string[] {
  return Object.keys(contacts).filter((id) => contacts[id].discoveredFrom === 'auto');
}

/** Contato revelado ao coletar `itemId` (`discoveredFrom` = id do item), ou null. */
export function contactRevealedByItem(
  contacts: Record<string, DiscoverableContact>,
  itemId: string,
): string | null {
  for (const [id, contact] of Object.entries(contacts)) {
    if (contact.discoveredFrom === itemId) return id;
  }
  return null;
}
