// A-B loop: the A-B button sets A, then B, then turns the loop off.

import type { PlayerContext } from './context';
import { formatTime } from './format';
import { $, showToast } from './utils';

export interface LoopApi {
  cycle: () => void;
  /** Jumps back to A once `time` reaches B (called on timeupdate and on every frame). */
  enforce: (time: number) => void;
  isLooping: () => boolean;
}

export function initLoop(ctx: PlayerContext): LoopApi {
  const { video } = ctx;
  const button = $('#btnLoop');
  const range = $('#loopRange');
  const hasDuration = (): boolean => Number.isFinite(video.duration) && video.duration > 0;
  const fmt = (t: number): string => formatTime(t, hasDuration() && video.duration >= 3600);

  let loopA: number | null = null;
  let loopB: number | null = null;

  function render(): void {
    const label =
      loopA === null
        ? 'A-B loop: set point A'
        : loopB === null
          ? 'A-B loop: set point B'
          : 'A-B loop: turn off';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.setAttribute('aria-pressed', String(loopB !== null));
    button.classList.toggle('is-active', loopB !== null);
    button.classList.toggle('is-pending', loopA !== null && loopB === null);
    if (loopA === null || !hasDuration()) {
      range.hidden = true;
      return;
    }
    const end = loopB ?? loopA;
    range.hidden = false;
    range.style.left = `${String((loopA / video.duration) * 100)}%`;
    range.style.width = `${String(((end - loopA) / video.duration) * 100)}%`;
  }

  function clear(): void {
    loopA = null;
    loopB = null;
    render();
  }

  function cycle(): void {
    if (!hasDuration()) return;
    const t = video.currentTime;
    if (loopA === null) {
      loopA = t;
      showToast(`Loop start (A) at ${fmt(t)}. Click again to set the end (B).`, 2500);
    } else if (loopB === null) {
      if (t <= loopA + 0.3) {
        showToast('Point B must be after point A');
        return;
      }
      loopB = t;
      showToast(`Looping ${fmt(loopA)} → ${fmt(loopB)}`);
      video.currentTime = loopA;
    } else {
      clear();
      showToast('Loop off');
      return;
    }
    render();
  }

  function enforce(time: number): void {
    if (loopA !== null && loopB !== null && !video.seeking && time >= loopB) video.currentTime = loopA;
  }

  button.addEventListener('click', cycle);
  video.addEventListener('timeupdate', () => {
    enforce(video.currentTime);
  });
  video.addEventListener('ended', () => {
    if (loopA === null || loopB === null) return;
    video.currentTime = loopA;
    video.play().catch(() => undefined);
  });
  video.addEventListener('loadedmetadata', render);
  ctx.onSourceChange(clear);

  return { cycle, enforce, isLooping: () => loopB !== null };
}
