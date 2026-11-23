// Appearance: light/dark/system theme and accent color, saved in localStorage
// (shared by every Lumen page; read synchronously by shared/theme-boot.js).

import { $, setupMenu } from './utils.js';
import { icons } from './icons.js';

const STORAGE_KEY = 'lumen.appearance';
export const ACCENTS = [
  { id: 'amber', label: 'Amber', color: '#ffb454' },
  { id: 'orange', label: 'Orange', color: '#ff7a1a' },
  { id: 'red', label: 'Red', color: '#ff4d4f' },
  { id: 'pink', label: 'Pink', color: '#ff5fa2' },
  { id: 'purple', label: 'Purple', color: '#a78bfa' },
  { id: 'blue', label: 'Blue', color: '#4c9aff' },
  { id: 'green', label: 'Green', color: '#34d399' },
  { id: 'white', label: 'White', color: '#f4f4f5' },
];
const THEMES = ['light', 'dark', 'system'];
const systemLight = window.matchMedia('(prefers-color-scheme: light)');

function readAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    return {
      theme: THEMES.includes(saved.theme) ? saved.theme : 'dark',
      accent: ACCENTS.some((a) => a.id === saved.accent) ? saved.accent : 'amber',
    };
  } catch {
    return { theme: 'dark', accent: 'amber' };
  }
}

export function initAppearance() {
  const root = document.documentElement;
  const btnToggle = $('#btnThemeToggle');
  const menu = $('#appearanceMenu');
  const swatches = $('#accentSwatches');
  let appearance = readAppearance();

  setupMenu($('#btnAppearance'), menu);

  const resolvedTheme = () =>
    appearance.theme === 'system' ? (systemLight.matches ? 'light' : 'dark') : appearance.theme;

  function apply() {
    const theme = resolvedTheme();
    root.dataset.theme = theme;
    root.dataset.accent = appearance.accent;

    btnToggle.innerHTML = theme === 'dark' ? icons.sun : icons.moon;
    const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    btnToggle.setAttribute('aria-label', label);
    btnToggle.title = label;

    for (const btn of menu.querySelectorAll('[data-theme-choice]')) {
      btn.setAttribute('aria-checked', String(btn.dataset.themeChoice === appearance.theme));
    }
    for (const btn of swatches.children) {
      btn.setAttribute('aria-checked', String(btn.dataset.accent === appearance.accent));
    }
  }

  function save(changes) {
    appearance = { ...appearance, ...changes };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
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
    btn.addEventListener('click', () => save({ accent: accent.id }));
    swatches.append(btn);
  }

  menu.querySelectorAll('[data-theme-choice]').forEach((btn) =>
    btn.addEventListener('click', () => save({ theme: btn.dataset.themeChoice })));
  btnToggle.addEventListener('click', () => save({ theme: resolvedTheme() === 'dark' ? 'light' : 'dark' }));

  systemLight.addEventListener('change', apply);
  // Keep other open Lumen tabs in sync.
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      appearance = readAppearance();
      apply();
    }
  });

  apply();
}
