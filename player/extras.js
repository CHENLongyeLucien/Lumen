// Enhancements: A-B loop, frame by frame, screenshot, remembered position.

import { $, clamp, formatTime, loadSetting, saveSetting, showToast } from './utils.js';

const POSITIONS_KEY = 'positions';
const MAX_POSITIONS = 200;
const SAVE_INTERVAL_MS = 5000;
const MIN_DURATION_TO_REMEMBER = 30; // seconds; short clips always start at 0
const DEFAULT_FRAME = 1 / 30;

export function initExtras(ctx, { showUI }) {
  const { video } = ctx;
  const btnLoop = $('#btnLoop');
  const loopRange = $('#loopRange');
  const hasDuration = () => Number.isFinite(video.duration) && video.duration > 0;
  const fmt = (t) => formatTime(t, hasDuration() && video.duration >= 3600);

  /* ---------- A-B loop ---------- */

  let loopA = null;
  let loopB = null;

  function clearLoop() {
    loopA = null;
    loopB = null;
    renderLoop();
  }

  function cycleLoop() {
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

  function renderLoop() {
    const label = loopA === null ? 'A-B loop: set point A' : loopB === null ? 'A-B loop: set point B' : 'A-B loop: turn off';
    btnLoop.setAttribute('aria-label', label);
    btnLoop.title = label;
    btnLoop.setAttribute('aria-pressed', String(loopB !== null));
    btnLoop.classList.toggle('is-active', loopB !== null);
    btnLoop.classList.toggle('is-pending', loopA !== null && loopB === null);
    if (loopA === null || !hasDuration()) { loopRange.hidden = true; return; }
    const end = loopB ?? loopA;
    loopRange.hidden = false;
    loopRange.style.left = `${(loopA / video.duration) * 100}%`;
    loopRange.style.width = `${((end - loopA) / video.duration) * 100}%`;
  }

  function enforceLoop(time) {
    if (loopB !== null && !video.seeking && time >= loopB) video.currentTime = loopA;
  }

  btnLoop.addEventListener('click', cycleLoop);
  video.addEventListener('timeupdate', () => enforceLoop(video.currentTime));
  video.addEventListener('ended', () => {
    if (loopB === null) return;
    video.currentTime = loopA;
    video.play().catch(() => {});
  });

  /* ---------- Frame rate estimate + frame by frame ---------- */

  let frameDuration = DEFAULT_FRAME;
  let frameSamples = 0;
  let lastFrame = null;
  let frameCallbackId = 0;
  const supportsFrameCallback = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

  function onVideoFrame(_now, meta) {
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

  function stepFrame(direction) {
    if (!hasDuration()) return;
    video.pause();
    video.currentTime = clamp(video.currentTime + direction * frameDuration, 0, video.duration);
    showUI();
  }

  const getFrameRate = () => (frameSamples >= 5 ? 1 / frameDuration : null);

  /* ---------- Screenshot ---------- */

  async function screenshot() {
    if (!video.videoWidth) {
      showToast('No image to capture yet');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const g = canvas.getContext('2d');
    g.filter = ctx.imageFilter || 'none';
    g.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.drawAnnotations?.(g, canvas.width, canvas.height); // include the user's drawing
    try {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Empty image'))), 'image/png');
      });
      const base = (ctx.source?.name || 'lumen').replace(/\.[^.]+$/, '');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${base}_${fmt(video.currentTime).replace(/:/g, '-')}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
      showToast('Screenshot saved');
    } catch (err) {
      console.warn('Lumen: screenshot failed', err);
      showToast(err.name === 'SecurityError'
        ? 'This video comes from another site that does not allow screenshots'
        : 'Screenshot failed');
    }
  }

  /* ---------- Remember playback position ---------- */

  let positionKey = null;
  let restorePromise = null;
  let canSave = false;
  let lastSaveAt = 0;
  let writeChain = Promise.resolve();

  async function readPositions() {
    const all = await loadSetting(POSITIONS_KEY, {});
    return all && typeof all === 'object' ? all : {};
  }

  function writePosition(key, time) {
    writeChain = writeChain
      .then(async () => {
        const all = await readPositions();
        if (time === null) delete all[key];
        else all[key] = { time, at: Date.now() };
        const keys = Object.keys(all);
        if (keys.length > MAX_POSITIONS) {
          keys.sort((a, b) => all[a].at - all[b].at)
            .slice(0, keys.length - MAX_POSITIONS)
            .forEach((k) => delete all[k]);
        }
        await saveSetting(POSITIONS_KEY, all);
      })
      .catch(() => {});
  }

  function savePosition(force = false) {
    if (!canSave || !positionKey || !hasDuration() || video.duration < MIN_DURATION_TO_REMEMBER) return;
    const now = Date.now();
    if (!force && now - lastSaveAt < SAVE_INTERVAL_MS) return;
    lastSaveAt = now;
    const t = video.currentTime;
    writePosition(positionKey, t > 5 && t < video.duration - 5 ? t : null);
  }

  ctx.events.addEventListener('sourcechange', (event) => {
    if (canSave) savePosition(true); // keep the previous file's position
    positionKey = event.detail.key;
    restorePromise = readPositions().then((all) => all[positionKey]?.time ?? null);
    canSave = false;
    lastSaveAt = 0;
    frameDuration = DEFAULT_FRAME;
    frameSamples = 0;
    clearLoop();
  });

  video.addEventListener('loadedmetadata', async () => {
    renderLoop();
    const pending = restorePromise;
    restorePromise = null;
    if (!pending) return;
    const time = await pending;
    canSave = true;
    if (time === null || !hasDuration() || video.duration < MIN_DURATION_TO_REMEMBER) return;
    if (time < 5 || time > video.duration - 5) return;
    video.currentTime = time;
    showToast(`Resumed at ${fmt(time)} · press 0 to start over`, 3500);
  });

  video.addEventListener('timeupdate', () => savePosition());
  video.addEventListener('pause', () => savePosition(true));
  video.addEventListener('ended', () => {
    if (positionKey && loopB === null) writePosition(positionKey, null);
  });
  window.addEventListener('pagehide', () => savePosition(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') savePosition(true);
  });

  return { cycleLoop, stepFrame, screenshot, getFrameRate };
}
