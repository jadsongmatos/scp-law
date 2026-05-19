import { describe, it, expect } from 'vitest';
import { resolveItemUse, INTERACT } from './itemUse';

// Decision table for the left-click context menu:
//  - objects may declare a `requiredItem`
//  - the player picks either INTERACT ("▸ Interagir") or an inventory item id
//  - once unlocked, a gated object behaves like a free one (persistent unlock)
describe('resolveItemUse', () => {
  describe('gated object, still locked', () => {
    it('correct item -> unlock', () => {
      expect(resolveItemUse({ requiredItem: 'isqueiro', selection: 'isqueiro', isUnlocked: false })).toBe('unlock');
    });
    it('wrong item -> denied', () => {
      expect(resolveItemUse({ requiredItem: 'isqueiro', selection: 'cedula_500', isUnlocked: false })).toBe('denied');
    });
    it('plain interact (no item) -> denied', () => {
      expect(resolveItemUse({ requiredItem: 'isqueiro', selection: INTERACT, isUnlocked: false })).toBe('denied');
    });
  });

  describe('gated object, already unlocked (persistent)', () => {
    it('interact -> interact (door stays open)', () => {
      expect(resolveItemUse({ requiredItem: 'isqueiro', selection: INTERACT, isUnlocked: true })).toBe('interact');
    });
    it('the former key item -> not-applicable (no re-unlock)', () => {
      expect(resolveItemUse({ requiredItem: 'isqueiro', selection: 'isqueiro', isUnlocked: true })).toBe('not-applicable');
    });
    it('any other item -> not-applicable', () => {
      expect(resolveItemUse({ requiredItem: 'isqueiro', selection: 'cedula_500', isUnlocked: true })).toBe('not-applicable');
    });
  });

  describe('free object (no requiredItem)', () => {
    it('interact -> interact', () => {
      expect(resolveItemUse({ selection: INTERACT, isUnlocked: false })).toBe('interact');
    });
    it('any item -> not-applicable', () => {
      expect(resolveItemUse({ selection: 'fotografia', isUnlocked: false })).toBe('not-applicable');
    });
  });
});
