// Applies the saved theme and accent before the page paints (no flash).
// Bundled as a classic (non-module) script, loaded in <head> by every Lumen page.

import { parseAppearance, resolveTheme } from './appearance-state';
import { APPEARANCE_KEY, DEFAULT_APPEARANCE } from './types';

const root = document.documentElement;
let appearance = DEFAULT_APPEARANCE;
try {
  appearance = parseAppearance(localStorage.getItem(APPEARANCE_KEY));
} catch {
  // localStorage unavailable: keep the defaults
}
root.dataset.theme = resolveTheme(appearance.theme, window.matchMedia('(prefers-color-scheme: light)').matches);
root.dataset.accent = appearance.accent;
