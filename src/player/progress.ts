// Progress bar: played/buffered ranges, time display, hover bubble and scrubbing.

import type { PlayerContext } from './context';
import { clamp, formatTime } from './format';
import { $ } from './utils';

export interface ProgressApi {
  render: () => void;
  isScrubbing: () => boolean;
}

interface ProgressDeps {
  seekTo: (time: number) => void;
  showUI: () => void;
}

const listen = (target: EventTarget, types: readonly string[], handler: () => void): void => {
  for (const type of types) target.addEventListener(type, handler);
};

export function initProgress(ctx: PlayerContext, { seekTo, showUI }: ProgressDeps): ProgressApi {
  const { player, video } = ctx;
  const progress = $('#progress');
  const track = $('#progressTrack');
  const played = $('#progressPlayed');
  const buffered = $('#progressBuffered');
  const thumb = $('#progressThumb');
  const bubble = $('#progressBubble');
  const timeCurrent = $('#timeCurrent');
  const timeDuration = $('#timeDuration');

  const hasDuration = (): boolean => Number.isFinite(video.duration) && video.duration > 0;
  const longVideo = (): boolean => hasDuration() && video.duration >= 3600;

  let scrubbing = false;
  let scrubTime = 0;

  /* ---------- Rendering ---------- */

  function render(): void {
    const duration = hasDuration() ? video.duration : 0;
    const current = scrubbing ? scrubTime : video.currentTime;
    const pct = duration ? clamp((current / duration) * 100, 0, 100) : 0;
    played.style.width = `${String(pct)}%`;
    thumb.style.left = `${String(pct)}%`;
    timeCurrent.textContent = formatTime(current, longVideo());
    progress.setAttribute('aria-valuenow', String(Math.floor(current)));
    progress.setAttribute('aria-valuetext', `${formatTime(current)} of ${formatTime(duration)}`);
  }

  /** Shows the buffered range that contains the current time. */
  function renderBuffered(): void {
    if (!hasDuration()) {
      buffered.style.width = '0';
      return;
    }
    const ranges = video.buffered;
    const t = video.currentTime;
    let end = 0;
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= t + 0.5 && ranges.end(i) >= t) {
        end = ranges.end(i);
        break;
      }
    }
    buffered.style.width = `${String(clamp((end / video.duration) * 100, 0, 100))}%`;
  }

  function renderDuration(): void {
    timeDuration.textContent = formatTime(video.duration, longVideo());
    progress.setAttribute('aria-valuemax', String(Math.floor(hasDuration() ? video.duration : 0)));
    render();
    renderBuffered();
  }

  video.addEventListener('timeupdate', () => {
    render();
    renderBuffered();
  });
  video.addEventListener('progress', renderBuffered);
  listen(video, ['durationchange', 'loadedmetadata', 'emptied'], renderDuration);

  // Smooth progress while playing (timeupdate only fires ~4 times per second).
  let rafId = 0;
  const tick = (): void => {
    render();
    rafId = requestAnimationFrame(tick);
  };
  video.addEventListener('playing', () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  });
  listen(video, ['pause', 'waiting', 'ended', 'emptied'], () => {
    cancelAnimationFrame(rafId);
  });

  /* ---------- Hover bubble and scrubbing ---------- */

  const fractionAt = (clientX: number): number => {
    const rect = track.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  };

  function updateBubble(clientX: number): void {
    if (!hasDuration()) return;
    const fraction = fractionAt(clientX);
    bubble.textContent = formatTime(fraction * video.duration, longVideo());
    const width = progress.clientWidth;
    const half = bubble.offsetWidth / 2;
    bubble.style.left = `${String(clamp(fraction * width, half, width - half))}px`;
  }

  function scrubTo(clientX: number): void {
    scrubTime = fractionAt(clientX) * video.duration;
    video.currentTime = scrubTime;
    render();
    updateBubble(clientX);
  }

  function endScrub(): void {
    if (!scrubbing) return;
    scrubbing = false;
    player.classList.remove('is-scrubbing');
    if (!progress.matches(':hover')) progress.classList.remove('is-hovering');
    render();
    showUI();
  }

  progress.addEventListener('pointerdown', (event) => {
    if (!hasDuration() || event.button !== 0) return;
    scrubbing = true;
    progress.setPointerCapture(event.pointerId);
    player.classList.add('is-scrubbing');
    scrubTo(event.clientX);
  });
  progress.addEventListener('pointermove', (event) => {
    updateBubble(event.clientX);
    if (scrubbing) scrubTo(event.clientX);
  });
  listen(progress, ['pointerup', 'pointercancel'], endScrub);
  progress.addEventListener('pointerenter', () => {
    progress.classList.add('is-hovering');
  });
  progress.addEventListener('pointerleave', () => {
    if (!scrubbing) progress.classList.remove('is-hovering');
  });
  progress.addEventListener('keydown', (event) => {
    if (event.key === 'Home') {
      seekTo(0);
      event.preventDefault();
    }
    if (event.key === 'End') {
      seekTo(video.duration);
      event.preventDefault();
    }
  });

  return { render, isScrubbing: () => scrubbing };
}
