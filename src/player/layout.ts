// Layout: default view (video + details) or theater mode (full-width video).

import { THEATER_KEY } from '../shared/types';
import type { PlayerContext } from './context';
import { icons } from './icons';
import { $, $as, showToast } from './utils';

export interface LayoutApi {
  toggleTheater: () => void;
}

export function initLayout(ctx: PlayerContext): LayoutApi {
  const btnTheater = $as('#btnTheater', HTMLButtonElement);
  const chip = $('#actTheater');
  let theater: boolean;
  try {
    theater = localStorage.getItem(THEATER_KEY) === '1';
  } catch {
    theater = false;
  }

  function setTheater(on: boolean): void {
    theater = on;
    ctx.app.classList.toggle('layout-theater', on);
    btnTheater.innerHTML = on ? icons.defaultView : icons.theater;
    const label = on ? 'Default view (T)' : 'Theater mode (T)';
    btnTheater.setAttribute('aria-label', label);
    btnTheater.title = label;
    chip.setAttribute('aria-pressed', String(on));
    try {
      localStorage.setItem(THEATER_KEY, on ? '1' : '0');
    } catch {
      /* not critical */
    }
  }

  function toggleTheater(): void {
    if (document.fullscreenElement) {
      showToast('Exit fullscreen to change the layout');
      return;
    }
    setTheater(!theater);
    ctx.player.scrollIntoView({ block: 'nearest' });
  }

  btnTheater.addEventListener('click', toggleTheater);
  chip.addEventListener('click', toggleTheater);
  $('#btnHeaderOpen').addEventListener('click', () => {
    $('#fileInput').click();
  });
  setTheater(theater);

  return { toggleTheater };
}
