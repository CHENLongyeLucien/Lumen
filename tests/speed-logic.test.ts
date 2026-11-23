import { describe, expect, it } from 'vitest';
import {
  clampRate,
  formatRate,
  isSameRate,
  MAX_RATE,
  MIN_RATE,
  nextRate,
  parseRateInput,
  SPEED_PRESETS,
} from '../src/player/speed-logic';

describe('presets', () => {
  it('go from 0.25x to 4x in order', () => {
    expect(SPEED_PRESETS[0]).toBe(0.25);
    expect(SPEED_PRESETS.at(-1)).toBe(4);
    expect([...SPEED_PRESETS].sort((a, b) => a - b)).toEqual(SPEED_PRESETS);
  });
});

describe('clampRate', () => {
  it('clamps to the 0.1x–16x range', () => {
    expect(clampRate(0.01)).toBe(MIN_RATE);
    expect(clampRate(0)).toBe(MIN_RATE);
    expect(clampRate(-3)).toBe(MIN_RATE);
    expect(clampRate(99)).toBe(MAX_RATE);
    expect(clampRate(16)).toBe(16);
  });

  it('rounds to two decimals', () => {
    expect(clampRate(1.234)).toBe(1.23);
    expect(clampRate(7.3)).toBe(7.3);
  });

  it('rejects non-finite values', () => {
    expect(clampRate(Number.NaN)).toBeNull();
    expect(clampRate(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('nextRate', () => {
  it('steps through the presets', () => {
    expect(nextRate(1, 1)).toBe(1.25);
    expect(nextRate(1, -1)).toBe(0.75);
    expect(nextRate(1.1, 1)).toBe(1.25); // from a custom value to the next preset
    expect(nextRate(1.1, -1)).toBe(1);
  });

  it('climbs by whole steps above 4x, up to 16x', () => {
    expect(nextRate(4, 1)).toBe(5);
    expect(nextRate(7.3, 1)).toBe(8);
    expect(nextRate(16, 1)).toBe(16);
  });

  it('goes down to 0.1x below the lowest preset', () => {
    expect(nextRate(0.25, -1)).toBe(MIN_RATE);
    expect(nextRate(0.1, -1)).toBe(MIN_RATE);
  });

  it('comes back from high custom values to the highest preset', () => {
    expect(nextRate(10, -1)).toBe(4);
  });
});

describe('formatRate / parseRateInput / isSameRate', () => {
  it('formats with at most two decimals', () => {
    expect(formatRate(1)).toBe('1x');
    expect(formatRate(1.5)).toBe('1.5x');
    expect(formatRate(0.25)).toBe('0.25x');
    expect(formatRate(1.2345)).toBe('1.23x');
  });

  it('parses dot or comma decimals (French keyboards)', () => {
    expect(parseRateInput('1.5')).toBe(1.5);
    expect(parseRateInput('1,5')).toBe(1.5);
    expect(parseRateInput('0')).toBeNull();
    expect(parseRateInput('-2')).toBeNull();
    expect(parseRateInput('abc')).toBeNull();
  });

  it('compares rates with a tolerance', () => {
    expect(isSameRate(0.1 + 0.2, 0.3)).toBe(true);
    expect(isSameRate(1, 1.25)).toBe(false);
  });
});
