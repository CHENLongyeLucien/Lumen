// Typed chrome.storage helpers. They degrade gracefully when the page runs
// outside the extension (no chrome.storage): reads return the fallback.

import type { StorageAreaName, StorageSchemas } from './types';

type Schema<A extends StorageAreaName> = StorageSchemas[A];
type Key<A extends StorageAreaName> = keyof Schema<A> & string;

function storageArea(name: StorageAreaName): chrome.storage.StorageArea | null {
  // `chrome` is undefined when a page is opened outside the extension (e.g. a dev server).
  const api = (globalThis as { chrome?: typeof chrome }).chrome;
  return api?.storage?.[name] ?? null;
}

/** Reads one key; returns `fallback` when missing, invalid (per `guard`) or unavailable. */
export async function readSetting<A extends StorageAreaName, K extends Key<A>>(
  area: A,
  key: K,
  fallback: Schema<A>[K],
  guard: (value: unknown) => value is Schema<A>[K],
): Promise<Schema<A>[K]> {
  const store = storageArea(area);
  if (!store) return fallback;
  try {
    const result: Record<string, unknown> = await store.get(key);
    const value = result[key];
    return guard(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

/** Writes one key; failures are logged, never thrown. */
export async function writeSetting<A extends StorageAreaName, K extends Key<A>>(
  area: A,
  key: K,
  value: Schema<A>[K],
): Promise<void> {
  const store = storageArea(area);
  if (!store) return;
  try {
    await store.set({ [key]: value });
  } catch (err) {
    console.warn('Lumen: could not save setting', key, err);
  }
}
