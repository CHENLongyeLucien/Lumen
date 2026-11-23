// Contracts shared by the service worker, the popup, the welcome page and the player.
//
// Lumen's contexts do not exchange runtime messages (no chrome.runtime.sendMessage).
// They communicate through three channels, all typed here:
//   1. chrome.storage: popup → service worker (redirect switch), player (volume, positions);
//   2. page URLs with a ?src= query: service worker → player / welcome page;
//   3. localStorage: appearance and layout, shared by every extension page.

/* ---------- 1. chrome.storage ---------- */

/** chrome.storage.sync */
export interface SyncStorageSchema {
  /** Open direct video links with Lumen (toggled from the popup). */
  redirectEnabled: boolean;
}

export interface VolumeSetting {
  level: number; // 0..1
  muted: boolean;
}

export interface SavedPosition {
  time: number; // seconds
  at: number; // Date.now() when saved, used to prune the oldest entries
}

/** Playback positions keyed by source key (URL, or file:name:size for opened files). */
export type SavedPositions = Record<string, SavedPosition>;

/** chrome.storage.local */
export interface LocalStorageSchema {
  volume: VolumeSetting;
  positions: SavedPositions;
}

export interface StorageSchemas {
  sync: SyncStorageSchema;
  local: LocalStorageSchema;
}

export type StorageAreaName = keyof StorageSchemas;

export const SYNC_DEFAULTS: SyncStorageSchema = { redirectEnabled: true };

/* ---------- 2. Page URLs ---------- */

export const PLAYER_PAGE = 'player/player.html';
export const WELCOME_PAGE = 'welcome/welcome.html';
export type ExtensionPage = typeof PLAYER_PAGE | typeof WELCOME_PAGE;

/** Query parameter carrying the original video URL: player.html?src=<encoded URL>. */
export const SOURCE_PARAM = 'src';

/* ---------- 3. localStorage ---------- */

export const APPEARANCE_KEY = 'lumen.appearance';
export const THEATER_KEY = 'lumen.theater';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const ACCENT_IDS = ['amber', 'orange', 'red', 'pink', 'purple', 'blue', 'green', 'white'] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

export interface Appearance {
  theme: ThemeChoice;
  accent: AccentId;
}

export const DEFAULT_APPEARANCE: Appearance = { theme: 'dark', accent: 'amber' };

/* ---------- Runtime guards (stored data is untrusted) ---------- */

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export const isVolumeSetting = (value: unknown): value is VolumeSetting =>
  isRecord(value) && typeof value.level === 'number' && typeof value.muted === 'boolean';

export const isSavedPositions = (value: unknown): value is SavedPositions =>
  isRecord(value) &&
  Object.values(value).every(
    (entry) => isRecord(entry) && typeof entry.time === 'number' && typeof entry.at === 'number',
  );
