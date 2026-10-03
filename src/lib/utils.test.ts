import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('should merge plain class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should return single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('should handle no arguments', () => {
    expect(cn()).toBe('');
  });

  it('should filter falsy values (null, undefined, false, 0)', () => {
    expect(cn('foo', null, undefined, false, 0, 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes via objects', () => {
    expect(cn({ active: true, disabled: false })).toBe('active');
  });

  it('should handle arrays of class values', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('should resolve tailwind class conflicts (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('should resolve tailwind conflicting responsive prefixes', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('should merge non-conflicting tailwind classes unchanged', () => {
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4');
  });

  it('should handle mixed conditional and tailwind conflict', () => {
    expect(cn('px-2', { 'px-4': true, 'py-1': false })).toBe('px-4');
  });

  it('should handle empty string input', () => {
    expect(cn('', 'foo')).toBe('foo');
  });

  it('should deduplicate conflicting tailwind classes', () => {
    expect(cn('px-2', 'px-2')).toBe('px-2');
  });
});
