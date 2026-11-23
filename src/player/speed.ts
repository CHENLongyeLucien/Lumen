// Playback speed: preset menu, free value (0.1x to 16x) and step up/down.

import type { PlayerContext } from './context';
import { clampRate, formatRate, isSameRate, nextRate, parseRateInput, SPEED_PRESETS } from './speed-logic';
import { $, $as, setupMenu, showToast } from './utils';

export interface SpeedApi {
  setSpeed: (rate: number, options?: { announce?: boolean }) => void;
  stepSpeed: (direction: number) => void;
}

export function initSpeed(ctx: PlayerContext): SpeedApi {
  const { video } = ctx;
  const button = $as('#btnSpeed', HTMLButtonElement);
  const menu = $('#speedMenu');
  const presets = $('#speedPresets');
  const input = $as('#speedInput', HTMLInputElement);

  const menuApi = setupMenu(button, menu, {
    onOpen: () => menu.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true }),
  });

  for (const rate of SPEED_PRESETS) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'menu-item';
    option.setAttribute('role', 'radio');
    option.dataset.rate = String(rate);
    option.textContent = formatRate(rate);
    option.addEventListener('click', () => {
      setSpeed(rate);
      menuApi.close();
      button.focus({ preventScroll: true });
    });
    presets.append(option);
  }

  function setSpeed(rate: number, { announce = false }: { announce?: boolean } = {}): void {
    const value = clampRate(rate);
    if (value === null) return;
    video.defaultPlaybackRate = value; // survives loading a new source
    video.playbackRate = value;
    if (announce) showToast(`Speed ${formatRate(value)}`);
  }

  function stepSpeed(direction: number): void {
    setSpeed(nextRate(video.playbackRate, direction), { announce: true });
  }

  function render(): void {
    const rate = video.playbackRate;
    button.textContent = formatRate(rate);
    button.setAttribute('aria-label', `Playback speed: ${formatRate(rate)}`);
    for (const option of presets.querySelectorAll<HTMLElement>('[data-rate]')) {
      option.setAttribute('aria-checked', String(isSameRate(Number(option.dataset.rate), rate)));
    }
    if (document.activeElement !== input) input.value = String(Number(rate.toFixed(2)));
  }

  input.addEventListener('change', () => {
    const value = parseRateInput(input.value);
    if (value !== null) setSpeed(value);
    render();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      input.blur(); // triggers "change"
      menuApi.close();
      button.focus({ preventScroll: true });
    }
  });
  input.addEventListener('blur', render);

  video.addEventListener('ratechange', render);
  render();

  return { setSpeed, stepSpeed };
}
