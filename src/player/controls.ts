// Control bar core: play/pause, seeking, click/double-click on the video,
// fullscreen, Picture-in-Picture, loading spinner and auto-hide.
// The progress bar and the volume live in progress.ts and volume.ts.

import type { PlayerContext } from './context';
import { clamp } from './format';
import { icons, type IconName } from './icons';
import { initProgress, type ProgressApi } from './progress';
import { createAutoHide } from './timing';
import { $, $as, anyMenuOpen, onMenuChange, showToast, wasMenuJustClosed } from './utils';
import { initVolume, type VolumeApi } from './volume';

const HIDE_DELAY_MS = 3000;
const POINTER_LEAVE_HIDE_MS = 700;
const CLICK_DELAY_MS = 220; // wait to tell a single click from a double click
const SIDE_ZONE = 0.3; // left/right 30% of the video = double-click to skip
const SPINNER_DELAY_MS = 350;

export interface ControlsApi extends VolumeApi {
  togglePlay: (options?: { flash?: boolean }) => void;
  seekBy: (delta: number) => void;
  seekTo: (time: number) => void;
  seekToFraction: (fraction: number) => void;
  toggleFullscreen: () => void;
  exitFullscreen: () => boolean;
  togglePip: () => Promise<void>;
  showUI: () => void;
  flashCenter: (icon: IconName) => void;
}

const listen = (target: EventTarget, types: readonly string[], handler: () => void): void => {
  for (const type of types) target.addEventListener(type, handler);
};

/** Restarts a CSS animation on an element. */
function replayAnimation(el: HTMLElement): void {
  el.classList.remove('is-animating');
  el.getBoundingClientRect(); // force a reflow so the animation starts again
  el.classList.add('is-animating');
}

export function initControls(ctx: PlayerContext): ControlsApi {
  const { player, video } = ctx;
  const hasDuration = (): boolean => Number.isFinite(video.duration) && video.duration > 0;

  /* ---------- Auto-hide (needs the progress bar's scrubbing state) ---------- */

  let progress: ProgressApi | null = null;
  let pointerOverControls = false;
  const autoHide = createAutoHide({
    delay: HIDE_DELAY_MS,
    canHide: () =>
      Boolean(ctx.source) &&
      !video.paused &&
      !(progress?.isScrubbing() ?? false) &&
      !pointerOverControls &&
      !anyMenuOpen(),
    onShow: () => {
      player.classList.remove('ui-hidden');
    },
    onHide: () => {
      player.classList.add('ui-hidden');
    },
  });
  const showUI = (): void => {
    autoHide.show();
  };

  /* ---------- Seeking ---------- */

  function seekTo(time: number): void {
    if (!hasDuration()) return;
    video.currentTime = clamp(time, 0, video.duration);
    progress?.render();
    showUI();
  }

  function seekBy(delta: number): void {
    if (!hasDuration()) return;
    seekTo(video.currentTime + delta);
    const el = $(delta < 0 ? '#seekFlashLeft' : '#seekFlashRight');
    $('span', el).textContent = `${delta < 0 ? '−' : '+'}${String(Math.abs(delta))} s`;
    replayAnimation(el);
  }

  function seekToFraction(fraction: number): void {
    if (hasDuration()) seekTo(fraction * video.duration);
  }

  progress = initProgress(ctx, { seekTo, showUI });
  const volume = initVolume(ctx);

  /* ---------- Play / pause ---------- */

  const btnPlay = $('#btnPlay');
  const centerIcon = $('#centerIcon');

  function flashCenter(iconName: IconName): void {
    centerIcon.innerHTML = icons[iconName];
    replayAnimation(centerIcon);
  }

  function togglePlay({ flash = false }: { flash?: boolean } = {}): void {
    if (!ctx.source) return;
    if (video.paused || video.ended) {
      video.play().catch((err: unknown) => {
        if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'NotSupportedError'))
          return;
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

  btnPlay.addEventListener('click', () => {
    togglePlay();
  });
  listen(video, ['play', 'pause', 'ended', 'emptied'], renderPlayState);
  $('#btnBack').addEventListener('click', () => {
    seekBy(-10);
  });
  $('#btnForward').addEventListener('click', () => {
    seekBy(10);
  });

  /* ---------- Click / double-click on the video ---------- */

  const stage = $('#stage');
  let clickTimer = 0;
  // Drawing and panning (zoom) also use the stage: their gestures are not clicks.
  const stageBusy = (): boolean => (ctx.isDrawing?.() ?? false) || (ctx.wasPanning?.() ?? false);

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

  /* ---------- Fullscreen ---------- */

  const btnFullscreen = $('#btnFullscreen');

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

  const btnPip = $as('#btnPip', HTMLButtonElement);

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

  const spinner = $('#spinner');
  let spinnerTimer = 0;
  listen(video, ['waiting', 'seeking'], () => {
    window.clearTimeout(spinnerTimer);
    spinnerTimer = window.setTimeout(() => {
      spinner.hidden = false;
    }, SPINNER_DELAY_MS);
  });
  listen(video, ['playing', 'canplay', 'seeked', 'pause', 'error', 'emptied', 'loadeddata'], () => {
    window.clearTimeout(spinnerTimer);
    spinner.hidden = true;
  });

  /* ---------- Auto-hide triggers ---------- */

  const controls = $('#controls');
  player.addEventListener('pointermove', (event) => {
    if (event.movementX === 0 && event.movementY === 0) return; // ignore synthetic moves
    showUI();
  });
  player.addEventListener('pointerleave', () => {
    if (!video.paused) autoHide.scheduleHide(POINTER_LEAVE_HIDE_MS);
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
    ...volume,
    togglePlay,
    seekBy,
    seekTo,
    seekToFraction,
    toggleFullscreen,
    exitFullscreen,
    togglePip,
    showUI,
    flashCenter,
  };
}
