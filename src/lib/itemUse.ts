// Pure decision logic for the left-click context menu that lets the player
// "use an item on an object" (an item as a key on a door, etc.).
//
// An object may declare a `requiredItem`. The player picks either INTERACT
// (the "▸ Interagir" menu entry — just act, no item) or an inventory item id.
// Once a gated object is unlocked it is recorded permanently and from then on
// behaves like a free object (the door stays open forever).

/** Sentinel for the "▸ Interagir" menu entry (act on the object, no item). */
export const INTERACT = '__interact__' as const;

/** What the player chose in the menu: INTERACT, or an inventory item id. */
export type ItemUseSelection = typeof INTERACT | (string & {});

export type ItemUseOutcome =
  | 'unlock' // gated object + correct item: play success, act, record unlock
  | 'interact' // free/already-unlocked object + INTERACT: perform normal action
  | 'denied' // still-gated object + wrong item or INTERACT: play failed message
  | 'not-applicable'; // free/unlocked object + some item: "não serve aqui"

export interface ItemUseInput {
  /** The object's required item, if it is gated. */
  requiredItem?: string;
  /** The player's menu selection. */
  selection: ItemUseSelection;
  /** Whether this object was already unlocked earlier (persistent state). */
  isUnlocked: boolean;
}

export function resolveItemUse({ requiredItem, selection, isUnlocked }: ItemUseInput): ItemUseOutcome {
  const gated = Boolean(requiredItem) && !isUnlocked;

  if (gated) {
    return selection === requiredItem ? 'unlock' : 'denied';
  }

  // Free object, or a gated object that was already unlocked: the lock no
  // longer matters, so plain interaction works and items do nothing here.
  return selection === INTERACT ? 'interact' : 'not-applicable';
}
