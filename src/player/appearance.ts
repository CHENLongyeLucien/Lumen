// Appearance: light/dark/system theme and accent color, saved in localStorage
// (shared by every Lumen page; read synchronously by shared/theme-boot.ts).

import { parseAppearance, resolveTheme } from '../shared/appearance-state';
import { APPEARANCE_KEY } from '../shared/types';
import type { AccentId, Appearance, ThemeChoice } from '../shared/types';
import { icons } from './icons';
import { $, setupMenu } from './utils';

export const ACCENTS: readonly { id: AccentId; label: string; color: string }[] = [
  { id: 'amber', label: 'Amber', color: '#ffb454' },
  { id: 'orange', label: 'Orange', color: '#ff7a1a' },
  { id: 'red', label: 'Red', color: '#ff4d4f' },
  { id: 'pink', label: 'Pink', color: '#ff5fa2' },
  { id: 'purple', label: 'Purple', color: '#a78bfa' },
  { id: 'blue', label: 'Blue', color: '#4c9aff' },
  { id: 'green', label: 'Green', color: '#34d399' },
  { id: 'white', label: 'White', color: '#f4f4f5' },
];

const isThemeChoice = (value: string | undefined): value is ThemeChoice =>
  value === 'light' || value === 'dark' || value === 'system';

const systemLight = window.matchMedia('(prefers-color-scheme: light)');

function readAppearance(): Appearance {
  try {
    return parseAppearance(localStorage.getItem(APPEARANCE_KEY));
  } catch {
    return parseAppearance(null);
  }
}

export function initAppearance(): void {
  const root = document.documentElement;
  const btnToggle = $<HTMLButtonElement>('#btnThemeToggle');
  const menu = $('#appearanceMenu');
  const swatches = $('#accentSwatches');
  let appearance = readAppearance();

  setupMenu($('#btnAppearance'), menu);

  const currentTheme = (): 'light' | 'dark' => resolveTheme(appearance.theme, systemLight.matches);

  function apply(): void {
    const theme = currentTheme();
    root.dataset.theme = theme;
    root.dataset.accent = appearance.accent;

    btnToggle.innerHTML = theme === 'dark' ? icons.sun : icons.moon;
    const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    btnToggle.setAttribute('aria-label', label);
    btnToggle.title = label;

    for (const btn of menu.querySelectorAll<HTMLElement>('[data-theme-choice]')) {
      btn.setAttribute('aria-checked', String(btn.dataset.themeChoice === appearance.theme));
    }
    for (const btn of swatches.querySelectorAll<HTMLElement>('[data-accent]')) {
      btn.setAttribute('aria-checked', String(btn.dataset.accent === appearance.accent));
    }
  }

  function save(changes: Partial<Appearance>): void {
    appearance = { ...appearance, ...changes };
    try {
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
    } catch {
      /* storage unavailable: the choice still applies to this page */
    }
    apply();
  }

  for (const accent of ACCENTS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'swatch';
    btn.dataset.accent = accent.id;
    btn.style.setProperty('--swatch', accent.color);
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-label', accent.label);
    btn.title = accent.label;
    btn.addEventListener('click', () => {
      save({ accent: accent.id });
    });
    swatches.append(btn);
  }

  menu.querySelectorAll<HTMLElement>('[data-theme-choice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const choice = btn.dataset.themeChoice;
      if (isThemeChoice(choice)) save({ theme: choice });
    });
  });
  btnToggle.addEventListener('click', () => {
    save({ theme: currentTheme() === 'dark' ? 'light' : 'dark' });
  });

  systemLight.addEventListener('change', apply);
  // Keep other open Lumen tabs in sync.
  window.addEventListener('storage', (event) => {
    if (event.key === APPEARANCE_KEY) {
      appearance = readAppearance();
      apply();
    }
  });

  apply();
}
