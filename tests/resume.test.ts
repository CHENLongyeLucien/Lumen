import { describe, expect, it } from 'vitest';
import {
  isRememberable,
  MAX_POSITIONS,
  MIN_DURATION_TO_REMEMBER,
  positionToSave,
  shouldRestore,
  updatePositions,
} from '../src/player/resume';
import type { SavedPositions } from '../src/shared/types';

describe('30-second rule', () => {
  it('only remembers videos of 30 s or more', () => {
    expect(MIN_DURATION_TO_REMEMBER).toBe(30);
    expect(isRememberable(29.9)).toBe(false);
    expect(isRememberable(30)).toBe(true);
    expect(isRememberable(Number.NaN)).toBe(false);
    expect(isRememberable(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('never restores on short videos', () => {
    expect(shouldRestore(10, 20)).toBe(false);
  });
});

describe('positionToSave', () => {
  it('saves positions away from the start and the end', () => {
    expect(positionToSave(42, 100)).toBe(42);
  });

  it('forgets positions in the first or last 5 seconds', () => {
    expect(positionToSave(5, 100)).toBeNull();
    expect(positionToSave(0, 100)).toBeNull();
    expect(positionToSave(95, 100)).toBeNull();
    expect(positionToSave(99, 100)).toBeNull();
  });
});

describe('shouldRestore', () => {
  it('restores a saved position inside the video', () => {
    expect(shouldRestore(60, 600)).toBe(true);
    expect(shouldRestore(5, 600)).toBe(true);
    expect(shouldRestore(595, 600)).toBe(true);
  });

  it('does not restore missing or out-of-range positions', () => {
    expect(shouldRestore(null, 600)).toBe(false);
    expect(shouldRestore(4.9, 600)).toBe(false);
    expect(shouldRestore(596, 600)).toBe(false);
    expect(shouldRestore(900, 600)).toBe(false);
  });
});

describe('updatePositions', () => {
  const base: SavedPositions = { a: { time: 10, at: 1 }, b: { time: 20, at: 2 } };

  it('saves a new position without mutating the input', () => {
    const next = updatePositions(base, 'c', 30, 3);
    expect(next).toEqual({ ...base, c: { time: 30, at: 3 } });
    expect(base).not.toHaveProperty('c');
  });

  it('overwrites an existing key', () => {
    expect(updatePositions(base, 'a', 99, 5).a).toEqual({ time: 99, at: 5 });
  });

  it('removes a key when time is null', () => {
    expect(updatePositions(base, 'a', null, 5)).toEqual({ b: { time: 20, at: 2 } });
    expect(updatePositions(base, 'missing', null, 5)).toEqual(base);
  });

  it('keeps only the most recent entries', () => {
    const next = updatePositions(base, 'c', 30, 3, 2);
    expect(Object.keys(next).sort()).toEqual(['b', 'c']);
  });

  it(`caps the store at ${String(MAX_POSITIONS)} entries by default`, () => {
    const many: SavedPositions = Object.fromEntries(
      Array.from({ length: MAX_POSITIONS }, (_, i) => [`k${String(i)}`, { time: 10, at: i }]),
    );
    const next = updatePositions(many, 'new', 50, 10_000);
    expect(Object.keys(next)).toHaveLength(MAX_POSITIONS);
    expect(next).toHaveProperty('new');
    expect(next).not.toHaveProperty('k0'); // the oldest one was dropped
  });
});
