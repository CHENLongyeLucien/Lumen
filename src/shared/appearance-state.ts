// Pure appearance logic shared by the theme boot script and the player's appearance menu.

import { ACCENT_IDS, DEFAULT_APPEARANCE, isRecord } from './types';
import type { AccentId, Appearance, ResolvedTheme, ThemeChoice } from './types';

const THEMES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

const isTheme = (value: unknown): value is ThemeChoice =>
  typeof value === 'string' && (THEMES as readonly string[]).includes(value);

const isAccent = (value: unknown): value is AccentId =>
  typeof value === 'string' && (ACCENT_IDS as readonly string[]).includes(value);

/** Parses the saved localStorage value, falling back to defaults field by field. */
export function parseAppearance(raw: string | null): Appearance {
  let saved: unknown;
  try {
    saved = JSON.parse(raw ?? '{}');
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
  if (!isRecord(saved)) return { ...DEFAULT_APPEARANCE };
  return {
    theme: isTheme(saved.theme) ? saved.theme : DEFAULT_APPEARANCE.theme,
    accent: isAccent(saved.accent) ? saved.accent : DEFAULT_APPEARANCE.accent,
  };
}

/** "system" follows the OS preference. */
export const resolveTheme = (choice: ThemeChoice, prefersLight: boolean): ResolvedTheme =>
  choice === 'system' ? (prefersLight ? 'light' : 'dark') : choice;
