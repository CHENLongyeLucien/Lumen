// Playback speed: preset menu, free value (0.1x to 16x) and step up/down.

import { $, clamp, setupMenu, showToast } from './utils.js';

const PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const MIN_RATE = 0.1;
const MAX_RATE = 16;

export const formatRate = (rate) => `${Number(rate.toFixed(2))}x`;

export function initSpeed(ctx) {
  const { video } = ctx;
  const button = $('#btnSpeed');
  const menu = $('#speedMenu');
  const presets = $('#speedPresets');
  const input = $('#speedInput');

  const menuApi = setupMenu(button, menu, {
    onOpen: () => menu.querySelector('[aria-checked="true"]')?.focus({ preventScroll: true }),
  });

  for (const rate of PRESETS) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'menu-item';
    option.setAttribute('role', 'menuitemradio');
    option.dataset.rate = String(rate);
    option.textContent = formatRate(rate);
    option.addEventListener('click', () => {
      setSpeed(rate);
      menuApi.close();
      button.focus({ preventScroll: true });
    });
    presets.append(option);
  }

  function setSpeed(rate, { announce = false } = {}) {
    if (!Number.isFinite(rate)) return;
    const value = clamp(Math.round(rate * 100) / 100, MIN_RATE, MAX_RATE);
    video.defaultPlaybackRate = value; // survives loading a new source
    video.playbackRate = value;
    if (announce) showToast(`Speed ${formatRate(value)}`);
  }

  function stepSpeed(direction) {
    const rate = video.playbackRate;
    let next;
    if (direction > 0) {
      next = PRESETS.find((p) => p > rate + 1e-6) ?? Math.min(MAX_RATE, Math.floor(rate) + 1);
    } else {
      next = [...PRESETS].reverse().find((p) => p < rate - 1e-6) ?? MIN_RATE;
    }
    setSpeed(next, { announce: true });
  }

  function render() {
    const rate = video.playbackRate;
    button.textContent = formatRate(rate);
    button.setAttribute('aria-label', `Playback speed: ${formatRate(rate)}`);
    for (const option of presets.children) {
      option.setAttribute('aria-checked', String(Math.abs(Number(option.dataset.rate) - rate) < 1e-6));
    }
    if (document.activeElement !== input) input.value = String(Number(rate.toFixed(2)));
  }

  input.addEventListener('change', () => {
    const value = Number(input.value.replace(',', '.'));
    if (Number.isFinite(value) && value > 0) setSpeed(value);
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
