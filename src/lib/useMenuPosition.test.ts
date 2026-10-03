import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { adjustMenuPosition } from './useMenuPosition';

function makeEl(overrides: { offsetWidth?: number; offsetHeight?: number } = {}) {
  const style: Record<string, string> = {};
  return {
    offsetWidth: overrides.offsetWidth ?? 200,
    offsetHeight: overrides.offsetHeight ?? 150,
    style,
  } as unknown as HTMLDivElement;
}

const MOCK_WINDOW = { innerWidth: 1024, innerHeight: 768 };

describe('adjustMenuPosition', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).window = MOCK_WINDOW;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
  });

  it('should position at desired coords when menu fits on screen', () => {
    const el = makeEl();
    adjustMenuPosition(el, 100, 200);
    expect(el.style.left).toBe('100px');
    expect(el.style.top).toBe('200px');
  });

  it('should flip left when menu overflows viewport right edge', () => {
    const el = makeEl({ offsetWidth: 200 });
    adjustMenuPosition(el, 900, 100);
    expect(el.style.left).toBe('700px');
  });

  it('should flip up when menu overflows viewport bottom edge', () => {
    const el = makeEl({ offsetHeight: 200 });
    adjustMenuPosition(el, 100, 650);
    expect(el.style.top).toBe('450px');
  });

  it('should clamp to MARGIN when desired minus width is below margin', () => {
    const el = makeEl({ offsetWidth: 1000 });
    adjustMenuPosition(el, 950, 100);
    expect(el.style.left).toBe('8px');
  });

  it('should use Math.max when flipped x exceeds margin', () => {
    const el = makeEl({ offsetWidth: 900 });
    adjustMenuPosition(el, 950, 100);
    expect(el.style.left).toBe('50px');
  });

  it('should clamp to MARGIN vertically when flipped y is below margin', () => {
    const el = makeEl({ offsetHeight: 1000 });
    adjustMenuPosition(el, 100, 950);
    expect(el.style.top).toBe('8px');
  });

  it('should handle zero-size element', () => {
    const el = makeEl({ offsetWidth: 0, offsetHeight: 0 });
    adjustMenuPosition(el, 500, 400);
    expect(el.style.left).toBe('500px');
    expect(el.style.top).toBe('400px');
  });

  it('should handle desired position at origin', () => {
    const el = makeEl();
    adjustMenuPosition(el, 0, 0);
    expect(el.style.left).toBe('0px');
    expect(el.style.top).toBe('0px');
  });

  it('should handle both axes overflowing simultaneously', () => {
    const el = makeEl({ offsetWidth: 300, offsetHeight: 300 });
    adjustMenuPosition(el, 850, 600);
    expect(parseInt(el.style.left)).toBeLessThan(850);
    expect(parseInt(el.style.top)).toBeLessThan(600);
  });
});
