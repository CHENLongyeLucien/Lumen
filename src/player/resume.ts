// Pure rules for remembering the playback position.

import type { SavedPositions } from '../shared/types';

/** Videos shorter than this always start at 0. */
export const MIN_DURATION_TO_REMEMBER = 30;
/** Positions this close to the start or the end are not worth resuming. */
export const EDGE_MARGIN = 5;
export const MAX_POSITIONS = 200;

export const isRememberable = (duration: number): boolean =>
  Number.isFinite(duration) && duration >= MIN_DURATION_TO_REMEMBER;

/** The position to store for `time`, or null to forget it (near the start or the end). */
export function positionToSave(time: number, duration: number): number | null {
  return time > EDGE_MARGIN && time < duration - EDGE_MARGIN ? time : null;
}

/** Whether a saved position should be restored for a video of this duration. */
export function shouldRestore(time: number | null, duration: number): time is number {
  if (time === null || !isRememberable(duration)) return false;
  return time >= EDGE_MARGIN && time <= duration - EDGE_MARGIN;
}

/**
 * Returns a new map with `key` set to `time` (or removed when `time` is null),
 * keeping only the `max` most recently saved entries.
 */
export function updatePositions(
  all: SavedPositions,
  key: string,
  time: number | null,
  now: number,
  max: number = MAX_POSITIONS,
): SavedPositions {
  const entries = Object.entries(all).filter(([k]) => k !== key);
  if (time !== null) entries.push([key, { time, at: now }]);
  entries.sort(([, a], [, b]) => a.at - b.at);
  return Object.fromEntries(entries.slice(Math.max(0, entries.length - max)));
}
