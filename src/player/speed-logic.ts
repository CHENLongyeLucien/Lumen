// Pure playback-speed rules.

import { clamp } from './format';

export const SPEED_PRESETS: readonly number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
export const MIN_RATE = 0.1;
export const MAX_RATE = 16;
const EPSILON = 1e-6;

/** "1.5x", "0.25x", "7.3x" (at most two decimals). */
export const formatRate = (rate: number): string => `${String(Number(rate.toFixed(2)))}x`;

/** Rounds to 2 decimals and clamps to [0.1, 16]; returns null for non-finite input. */
export function clampRate(rate: number): number | null {
  if (!Number.isFinite(rate)) return null;
  return clamp(Math.round(rate * 100) / 100, MIN_RATE, MAX_RATE);
}

/** Next preset up/down; beyond 4x it climbs by whole steps up to 16x, below 0.25x it goes to 0.1x. */
export function nextRate(rate: number, direction: number): number {
  if (direction > 0) {
    return SPEED_PRESETS.find((p) => p > rate + EPSILON) ?? Math.min(MAX_RATE, Math.floor(rate) + 1);
  }
  return [...SPEED_PRESETS].reverse().find((p) => p < rate - EPSILON) ?? MIN_RATE;
}

/** Parses the custom speed field ("1.5" or "1,5"); null when not a positive number. */
export function parseRateInput(text: string): number | null {
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export const isSameRate = (a: number, b: number): boolean => Math.abs(a - b) < EPSILON;
