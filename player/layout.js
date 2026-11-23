// Layout: default view (video + details) or theater mode (full-width video).

import { $, showToast } from './utils.js';
import { icons } from './icons.js';

const STORAGE_KEY = 'lumen.theater';

export function initLayout(ctx) {
  const btnTheater = $('#btnTheater');
  const chip = $('#actTheater');
  let theater = false;
  try {
    theater = localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    theater = false;
  }

  function setTheater(on) {
    theater = on;
    ctx.app.classList.toggle('layout-theater', on);
    btnTheater.innerHTML = on ? icons.defaultView : icons.theater;
    const label = on ? 'Default view (T)' : 'Theater mode (T)';
    btnTheater.setAttribute('aria-label', label);
    btnTheater.title = label;
    chip.setAttribute('aria-pressed', String(on));
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch {
      /* not critical */
    }
  }

  function toggleTheater() {
    if (document.fullscreenElement) {
      showToast('Exit fullscreen to change the layout');
      return;
    }
    setTheater(!theater);
    ctx.player.scrollIntoView({ block: 'nearest' });
  }

  btnTheater.addEventListener('click', toggleTheater);
  chip.addEventListener('click', toggleTheater);
  $('#btnHeaderOpen').addEventListener('click', () => $('#fileInput').click());
  setTheater(theater);

  return { toggleTheater };
}
