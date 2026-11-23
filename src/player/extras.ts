// Enhancements: A-B loop, frame by frame, screenshot, remembered position.

import { readSetting, writeSetting } from '../shared/storage';
import { isSavedPositions } from '../shared/types';
import type { SavedPositions } from '../shared/types';
import type { PlayerContext } from './context';
import { isRememberable, positionToSave, shouldRestore, updatePositions } from './resume';
import { $, $as, clamp, formatTime, showToast } from './utils';

const SAVE_INTERVAL_MS = 5000;
const DEFAULT_FRAME = 1 / 30;

export interface ExtrasApi {
  cycleLoop: () => void;
  stepFrame: (direction: number) => void;
  screenshot: () => Promise<void>;
  getFrameRate: () => number | null;
}

export function initExtras(ctx: PlayerContext, { showUI }: { showUI: () => void }): ExtrasApi {
  const { video } = ctx;
  const btnLoop = $as('#btnLoop', HTMLButtonElement);
  const loopRange = $('#loopRange');
  const hasDuration = (): boolean => Number.isFinite(video.duration) && video.duration > 0;
  const fmt = (t: number): string => formatTime(t, hasDuration() && video.duration >= 3600);

  /* ---------- A-B loop ---------- */

  let loopA: number | null = null;
  let loopB: number | null = null;

  function clearLoop(): void {
    loopA = null;
    loopB = null;
    renderLoop();
  }

  function cycleLoop(): void {
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
      clearLoop();
      showToast('Loop off');
      return;
    }
    renderLoop();
  }

  function renderLoop(): void {
    const label =
      loopA === null
        ? 'A-B loop: set point A'
        : loopB === null
          ? 'A-B loop: set point B'
          : 'A-B loop: turn off';
    btnLoop.setAttribute('aria-label', label);
    btnLoop.title = label;
    btnLoop.setAttribute('aria-pressed', String(loopB !== null));
    btnLoop.classList.toggle('is-active', loopB !== null);
    btnLoop.classList.toggle('is-pending', loopA !== null && loopB === null);
    if (loopA === null || !hasDuration()) {
      loopRange.hidden = true;
      return;
    }
    const end = loopB ?? loopA;
    loopRange.hidden = false;
    loopRange.style.left = `${String((loopA / video.duration) * 100)}%`;
    loopRange.style.width = `${String(((end - loopA) / video.duration) * 100)}%`;
  }

  function enforceLoop(time: number): void {
    if (loopA !== null && loopB !== null && !video.seeking && time >= loopB) video.currentTime = loopA;
  }

  btnLoop.addEventListener('click', cycleLoop);
  video.addEventListener('timeupdate', () => {
    enforceLoop(video.currentTime);
  });
  video.addEventListener('ended', () => {
    if (loopA === null || loopB === null) return;
    video.currentTime = loopA;
    video.play().catch(() => undefined);
  });

  /* ---------- Frame rate estimate + frame by frame ---------- */

  let frameDuration = DEFAULT_FRAME;
  let frameSamples = 0;
  let lastFrame: VideoFrameCallbackMetadata | null = null;
  let frameCallbackId = 0;
  const supportsFrameCallback = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

  function onVideoFrame(_now: DOMHighResTimeStamp, meta: VideoFrameCallbackMetadata): void {
    if (lastFrame && meta.presentedFrames - lastFrame.presentedFrames === 1 && video.playbackRate === 1) {
      const dt = meta.mediaTime - lastFrame.mediaTime;
      if (dt > 1 / 121 && dt < 1 / 9) {
        frameDuration = frameSamples === 0 ? dt : frameDuration * 0.9 + dt * 0.1;
        frameSamples += 1;
      }
    }
    lastFrame = meta;
    enforceLoop(meta.mediaTime); // more precise than timeupdate
    frameCallbackId = video.requestVideoFrameCallback(onVideoFrame);
  }

  video.addEventListener('play', () => {
    if (!supportsFrameCallback) return;
    video.cancelVideoFrameCallback(frameCallbackId);
    lastFrame = null;
    frameCallbackId = video.requestVideoFrameCallback(onVideoFrame);
  });

  function stepFrame(direction: number): void {
    if (!hasDuration()) return;
    video.pause();
    video.currentTime = clamp(video.currentTime + direction * frameDuration, 0, video.duration);
    showUI();
  }

  const getFrameRate = (): number | null => (frameSamples >= 5 ? 1 / frameDuration : null);

  /* ---------- Screenshot ---------- */

  async function screenshot(): Promise<void> {
    if (!video.videoWidth) {
      showToast('No image to capture yet');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const g = canvas.getContext('2d');
    if (!g) {
      showToast('Screenshot failed');
      return;
    }
    g.filter = ctx.imageFilter || 'none';
    g.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.drawAnnotations?.(g, canvas.width, canvas.height); // include the user's drawing
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Empty image'));
        }, 'image/png');
      });
      const base = (ctx.source?.name ?? 'lumen').replace(/\.[^.]+$/, '');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${base}_${fmt(video.currentTime).replace(/:/g, '-')}.png`;
      link.click();
      window.setTimeout(() => {
        URL.revokeObjectURL(link.href);
      }, 10000);
      showToast('Screenshot saved');
    } catch (err) {
      console.warn('Lumen: screenshot failed', err);
      showToast(
        err instanceof DOMException && err.name === 'SecurityError'
          ? 'This video comes from another site that does not allow screenshots'
          : 'Screenshot failed',
      );
    }
  }

  /* ---------- Remember playback position ---------- */

  let positionKey: string | null = null;
  let restorePromise: Promise<number | null> | null = null;
  let canSave = false;
  let lastSaveAt = 0;
  let writeChain: Promise<void> = Promise.resolve();

  const readPositions = (): Promise<SavedPositions> =>
    readSetting('local', 'positions', {}, isSavedPositions);

  function writePosition(key: string, time: number | null): void {
    writeChain = writeChain
      .then(async () => {
        const all = await readPositions();
        await writeSetting('local', 'positions', updatePositions(all, key, time, Date.now()));
      })
      .catch(() => undefined);
  }

  function savePosition(force = false): void {
    if (!canSave || !positionKey || !isRememberable(video.duration)) return;
    const now = Date.now();
    if (!force && now - lastSaveAt < SAVE_INTERVAL_MS) return;
    lastSaveAt = now;
    writePosition(positionKey, positionToSave(video.currentTime, video.duration));
  }

  ctx.onSourceChange((source) => {
    if (canSave) savePosition(true); // keep the previous file's position
    const key = source.key;
    positionKey = key;
    restorePromise = readPositions().then((all) => all[key]?.time ?? null);
    canSave = false;
    lastSaveAt = 0;
    frameDuration = DEFAULT_FRAME;
    frameSamples = 0;
    clearLoop();
  });

  async function restorePosition(): Promise<void> {
    const pending = restorePromise;
    restorePromise = null;
    if (!pending) return;
    const time = await pending;
    canSave = true;
    if (!shouldRestore(time, video.duration)) return;
    video.currentTime = time;
    showToast(`Resumed at ${fmt(time)} · press 0 to start over`, 3500);
  }

  video.addEventListener('loadedmetadata', () => {
    renderLoop();
    void restorePosition();
  });
  video.addEventListener('timeupdate', () => {
    savePosition();
  });
  video.addEventListener('pause', () => {
    savePosition(true);
  });
  video.addEventListener('ended', () => {
    if (positionKey && loopB === null) writePosition(positionKey, null);
  });
  window.addEventListener('pagehide', () => {
    savePosition(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') savePosition(true);
  });

  return { cycleLoop, stepFrame, screenshot, getFrameRate };
}
