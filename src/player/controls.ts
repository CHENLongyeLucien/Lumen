// Control bar: play/pause, progress bar, time, volume, fullscreen,
// Picture-in-Picture, click/double-click on the video and auto-hide.

import { readSetting, writeSetting } from '../shared/storage';
import { isVolumeSetting } from '../shared/types';
import type { PlayerContext } from './context';
import { icons, type IconName } from './icons';
import { createAutoHide, debounce } from './timing';
import { $, anyMenuOpen, clamp, formatTime, onMenuChange, showToast, wasMenuJustClosed } from './utils';

const HIDE_DELAY_MS = 3000;
const CLICK_DELAY_MS = 220; // wait to tell a single click from a double click
const SIDE_ZONE = 0.3; // left/right 30% of the video = double-click to skip

export interface ControlsApi {
  togglePlay(options?: { flash?: boolean }): void;
  seekBy(delta: number): void;
  seekTo(time: number): void;
  seekToFraction(fraction: number): void;
  changeVolume(delta: number): void;
  toggleMute(options?: { announce?: boolean }): void;
  toggleFullscreen(): void;
  exitFullscreen(): boolean;
  togglePip(): Promise<void>;
  showUI(): void;
  flashCenter(icon: IconName): void;
}

const listen = (target: EventTarget, types: string[], handler: () => void): void => {
  for (const type of types) target.addEventListener(type, handler);
};

export function initControls(ctx: PlayerContext): ControlsApi {
  const { player, video } = ctx;
  const stage = $('#stage');
  const controls = $('#controls');
  const btnPlay = $<HTMLButtonElement>('#btnPlay');
  const btnMute = $<HTMLButtonElement>('#btnMute');
  const volumeSlider = $<HTMLInputElement>('#volumeSlider');
  const btnPip = $<HTMLButtonElement>('#btnPip');
  const btnFullscreen = $<HTMLButtonElement>('#btnFullscreen');
  const progress = $('#progress');
  const track = $('#progressTrack');
  const played = $('#progressPlayed');
  const buffered = $('#progressBuffered');
  const thumb = $('#progressThumb');
  const bubble = $('#progressBubble');
  const timeCurrent = $('#timeCurrent');
  const timeDuration = $('#timeDuration');
  const centerIcon = $('#centerIcon');
  const spinner = $('#spinner');

  const hasDuration = (): boolean => Number.isFinite(video.duration) && video.duration > 0;
  const longVideo = (): boolean => hasDuration() && video.duration >= 3600;

  /* ---------- Play / pause ---------- */

  function togglePlay({ flash = false }: { flash?: boolean } = {}): void {
    if (!ctx.source) return;
    if (video.paused || video.ended) {
      video.play().catch((err: unknown) => {
        if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'NotSupportedError')) return;
        console.warn('Lumen: play() failed', err);
      });
    } else {
      video.pause();
    }
    if (flash) flashCenter(video.paused ? 'pause' : 'play');
  }

  function renderPlayState(): void {
    const paused = video.paused;
    btnPlay.innerHTML = paused ? icons.play : icons.pause;
    const label = paused ? 'Play (K)' : 'Pause (K)';
    btnPlay.setAttribute('aria-label', label);
    btnPlay.title = label;
    player.classList.toggle('is-paused', paused);
    showUI();
  }

  /** Restarts a CSS animation on an element. */
  function replayAnimation(el: HTMLElement): void {
    el.classList.remove('is-animating');
    void el.offsetWidth; // force a reflow so the animation starts again
    el.classList.add('is-animating');
  }

  function flashCenter(iconName: IconName): void {
    centerIcon.innerHTML = icons[iconName];
    replayAnimation(centerIcon);
  }

  function flashSeek(side: 'left' | 'right', text: string): void {
    const el = $(side === 'left' ? '#seekFlashLeft' : '#seekFlashRight');
    $('span', el).textContent = text;
    replayAnimation(el);
  }

  btnPlay.addEventListener('click', () => {
    togglePlay();
  });
  listen(video, ['play', 'pause', 'ended', 'emptied'], renderPlayState);

  /* ---------- Seeking ---------- */

  function seekTo(time: number): void {
    if (!hasDuration()) return;
    video.currentTime = clamp(time, 0, video.duration);
    renderProgress();
    showUI();
  }

  function seekBy(delta: number): void {
    if (!hasDuration()) return;
    seekTo(video.currentTime + delta);
    flashSeek(delta < 0 ? 'left' : 'right', `${delta < 0 ? '−' : '+'}${String(Math.abs(delta))} s`);
  }

  function seekToFraction(fraction: number): void {
    if (hasDuration()) seekTo(fraction * video.duration);
  }

  $('#btnBack').addEventListener('click', () => {
    seekBy(-10);
  });
  $('#btnForward').addEventListener('click', () => {
    seekBy(10);
  });

  /* ---------- Click / double-click on the video ---------- */

  let clickTimer = 0;
  // Drawing and panning (zoom) also use the stage: their gestures are not clicks.
  const stageBusy = (): boolean => Boolean(ctx.isDrawing?.() ?? false) || Boolean(ctx.wasPanning?.() ?? false);

  stage.addEventListener('click', () => {
    if (!ctx.source || wasMenuJustClosed() || stageBusy()) return;
    window.clearTimeout(clickTimer);
    clickTimer = window.setTimeout(() => {
      togglePlay({ flash: true });
    }, CLICK_DELAY_MS);
  });

  stage.addEventListener('dblclick', (event) => {
    window.clearTimeout(clickTimer);
    if (!ctx.source || stageBusy()) return;
    const rect = stage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    if (x < SIDE_ZONE) seekBy(-10);
    else if (x > 1 - SIDE_ZONE) seekBy(10);
    else toggleFullscreen();
  });

  /* ---------- Progress bar ---------- */

  let scrubbing = false;
  let scrubTime = 0;

  function renderProgress(): void {
    const duration = hasDuration() ? video.duration : 0;
    const current = scrubbing ? scrubTime : video.currentTime;
    const pct = duration ? clamp((current / duration) * 100, 0, 100) : 0;
    played.style.width = `${String(pct)}%`;
    thumb.style.left = `${String(pct)}%`;
    timeCurrent.textContent = formatTime(current, longVideo());
    progress.setAttribute('aria-valuenow', String(Math.floor(current)));
    progress.setAttribute('aria-valuetext', `${formatTime(current)} of ${formatTime(duration)}`);
  }

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
    renderProgress();
    renderBuffered();
  }

  video.addEventListener('timeupdate', () => {
    renderProgress();
    renderBuffered();
  });
  video.addEventListener('progress', renderBuffered);
  listen(video, ['durationchange', 'loadedmetadata', 'emptied'], renderDuration);

  // Smooth progress while playing (timeupdate only fires ~4 times per second).
  let rafId = 0;
  const tick = (): void => {
    renderProgress();
    rafId = requestAnimationFrame(tick);
  };
  video.addEventListener('playing', () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  });
  listen(video, ['pause', 'waiting', 'ended', 'emptied'], () => {
    cancelAnimationFrame(rafId);
  });

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
    renderProgress();
    updateBubble(clientX);
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
  const endScrub = (): void => {
    if (!scrubbing) return;
    scrubbing = false;
    player.classList.remove('is-scrubbing');
    if (!progress.matches(':hover')) progress.classList.remove('is-hovering');
    renderProgress();
    showUI();
  };
  listen(progress, ['pointerup', 'pointercancel'], endScrub);
  progress.addEventListener('pointerenter', () => progress.classList.add('is-hovering'));
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

  /* ---------- Volume ---------- */

  let lastAudibleVolume = 1;

  function setVolume(value: number): void {
    const volume = clamp(Math.round(value * 100) / 100, 0, 1);
    video.volume = volume;
    if (volume > 0) video.muted = false;
  }

  function changeVolume(delta: number): void {
    const base = video.muted ? 0 : video.volume;
    setVolume(base + delta);
    showToast(`Volume ${String(Math.round((video.muted ? 0 : video.volume) * 100))}%`);
  }

  function toggleMute({ announce = false }: { announce?: boolean } = {}): void {
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) video.volume = lastAudibleVolume || 0.5;
    } else {
      video.muted = true;
    }
    if (announce) showToast(video.muted ? 'Muted' : `Volume ${String(Math.round(video.volume * 100))}%`);
  }

  const saveVolume = debounce(() => {
    void writeSetting('local', 'volume', { level: video.volume, muted: video.muted });
  }, 300);

  function renderVolume(): void {
    const level = video.muted ? 0 : video.volume;
    if (video.volume > 0) lastAudibleVolume = video.volume;
    const percent = Math.round(level * 100);
    volumeSlider.value = String(percent);
    volumeSlider.style.setProperty('--fill', `${String(level * 100)}%`);
    volumeSlider.setAttribute('aria-valuetext', `${String(percent)}%`);
    btnMute.innerHTML = level === 0 ? icons.volumeMute : level < 0.5 ? icons.volumeLow : icons.volumeHigh;
    const label = level === 0 ? 'Unmute (M)' : 'Mute (M)';
    btnMute.setAttribute('aria-label', label);
    btnMute.title = label;
    saveVolume();
  }

  btnMute.addEventListener('click', () => {
    toggleMute();
  });
  volumeSlider.addEventListener('input', () => {
    setVolume(Number(volumeSlider.value) / 100);
  });
  video.addEventListener('volumechange', renderVolume);
  renderVolume();
  void readSetting('local', 'volume', { level: 1, muted: false }, isVolumeSetting).then((saved) => {
    video.volume = clamp(saved.level, 0, 1);
    video.muted = saved.muted;
    renderVolume();
  });

  /* ---------- Fullscreen ---------- */

  function toggleFullscreen(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      player.requestFullscreen().catch(() => {
        showToast('Fullscreen is not available here');
      });
    }
  }

  function exitFullscreen(): boolean {
    if (!document.fullscreenElement) return false;
    document.exitFullscreen().catch(() => undefined);
    return true;
  }

  function renderFullscreen(): void {
    const active = Boolean(document.fullscreenElement);
    btnFullscreen.innerHTML = active ? icons.fullscreenExit : icons.fullscreen;
    const label = active ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
    btnFullscreen.setAttribute('aria-label', label);
    btnFullscreen.title = label;
  }

  btnFullscreen.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', renderFullscreen);
  renderFullscreen();

  /* ---------- Picture-in-Picture ---------- */

  async function togglePip(): Promise<void> {
    if (!document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      showToast('Picture-in-Picture is not available for this video');
    }
  }

  const renderPip = (): void => {
    btnPip.disabled = video.readyState < HTMLMediaElement.HAVE_METADATA || !video.videoWidth;
    btnPip.classList.toggle('is-active', document.pictureInPictureElement === video);
  };

  if (!document.pictureInPictureEnabled) btnPip.hidden = true;
  btnPip.addEventListener('click', () => {
    void togglePip();
  });
  listen(video, ['loadedmetadata', 'emptied', 'enterpictureinpicture', 'leavepictureinpicture'], renderPip);
  renderPip();

  /* ---------- Loading spinner ---------- */

  let spinnerTimer = 0;
  const showSpinner = (): void => {
    window.clearTimeout(spinnerTimer);
    spinnerTimer = window.setTimeout(() => {
      spinner.hidden = false;
    }, 350);
  };
  const hideSpinner = (): void => {
    window.clearTimeout(spinnerTimer);
    spinner.hidden = true;
  };
  listen(video, ['waiting', 'seeking'], showSpinner);
  listen(video, ['playing', 'canplay', 'seeked', 'pause', 'error', 'emptied', 'loadeddata'], hideSpinner);

  /* ---------- Auto-hide ---------- */

  let pointerOverControls = false;
  const autoHide = createAutoHide({
    delay: HIDE_DELAY_MS,
    canHide: () => Boolean(ctx.source) && !video.paused && !scrubbing && !pointerOverControls && !anyMenuOpen(),
    onShow: () => player.classList.remove('ui-hidden'),
    onHide: () => player.classList.add('ui-hidden'),
  });
  const showUI = (): void => {
    autoHide.show();
  };

  player.addEventListener('pointermove', (event) => {
    if (event.movementX === 0 && event.movementY === 0) return; // ignore synthetic moves
    showUI();
  });
  player.addEventListener('pointerleave', () => {
    if (video.paused) return;
    autoHide.scheduleHide(700);
  });
  controls.addEventListener('pointerenter', () => {
    pointerOverControls = true;
    showUI();
  });
  controls.addEventListener('pointerleave', () => {
    pointerOverControls = false;
    showUI();
  });
  controls.addEventListener('focusin', showUI);
  onMenuChange(showUI);

  renderPlayState();

  return {
    togglePlay,
    seekBy,
    seekTo,
    seekToFraction,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    exitFullscreen,
    togglePip,
    showUI,
    flashCenter,
  };
}
