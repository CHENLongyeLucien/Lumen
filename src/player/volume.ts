// Volume: slider, mute button, keyboard steps and the remembered level.

import { readSetting, writeSetting } from '../shared/storage';
import { isVolumeSetting } from '../shared/types';
import type { PlayerContext } from './context';
import { clamp } from './format';
import { icons } from './icons';
import { debounce } from './timing';
import { $, $as, showToast } from './utils';

export interface VolumeApi {
  changeVolume: (delta: number) => void;
  toggleMute: (options?: { announce?: boolean }) => void;
}

const percent = (level: number): string => `${String(Math.round(level * 100))}%`;

export function initVolume(ctx: PlayerContext): VolumeApi {
  const { video } = ctx;
  const btnMute = $('#btnMute');
  const slider = $as('#volumeSlider', HTMLInputElement);
  let lastAudibleVolume = 1;

  function setVolume(value: number): void {
    const volume = clamp(Math.round(value * 100) / 100, 0, 1);
    video.volume = volume;
    if (volume > 0) video.muted = false;
  }

  function changeVolume(delta: number): void {
    const base = video.muted ? 0 : video.volume;
    setVolume(base + delta);
    showToast(`Volume ${percent(video.muted ? 0 : video.volume)}`);
  }

  function toggleMute({ announce = false }: { announce?: boolean } = {}): void {
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) video.volume = lastAudibleVolume || 0.5;
    } else {
      video.muted = true;
    }
    if (announce) showToast(video.muted ? 'Muted' : `Volume ${percent(video.volume)}`);
  }

  const save = debounce(() => {
    void writeSetting('local', 'volume', { level: video.volume, muted: video.muted });
  }, 300);

  function render(): void {
    const level = video.muted ? 0 : video.volume;
    if (video.volume > 0) lastAudibleVolume = video.volume;
    slider.value = String(Math.round(level * 100));
    slider.style.setProperty('--fill', `${String(level * 100)}%`);
    slider.setAttribute('aria-valuetext', percent(level));
    btnMute.innerHTML = level === 0 ? icons.volumeMute : level < 0.5 ? icons.volumeLow : icons.volumeHigh;
    const label = level === 0 ? 'Unmute (M)' : 'Mute (M)';
    btnMute.setAttribute('aria-label', label);
    btnMute.title = label;
    save();
  }

  btnMute.addEventListener('click', () => {
    toggleMute();
  });
  slider.addEventListener('input', () => {
    setVolume(Number(slider.value) / 100);
  });
  video.addEventListener('volumechange', render);
  render();
  void readSetting('local', 'volume', { level: 1, muted: false }, isVolumeSetting).then((saved) => {
    video.volume = clamp(saved.level, 0, 1);
    video.muted = saved.muted;
    render();
  });

  return { changeVolume, toggleMute };
}
