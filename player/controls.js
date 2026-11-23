// Control bar: play/pause, progress bar, time, volume, fullscreen,
// Picture-in-Picture, click/double-click on the video and auto-hide.

import {
  $, clamp, formatTime, loadSetting, saveSetting, showToast,
  anyMenuOpen, onMenuChange, wasMenuJustClosed,
} from './utils.js';
import { icons } from './icons.js';

const HIDE_DELAY_MS = 3000;
const CLICK_DELAY_MS = 220; // wait to tell a single click from a double click
const SIDE_ZONE = 0.3; // left/right 30% of the video = double-click to skip

export function initControls(ctx) {
  const { player, video } = ctx;
  const stage = $('#stage');
  const controls = $('#controls');
  const btnPlay = $('#btnPlay');
  const btnMute = $('#btnMute');
  const volumeSlider = $('#volumeSlider');
  const btnPip = $('#btnPip');
  const btnFullscreen = $('#btnFullscreen');
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

  const hasDuration = () => Number.isFinite(video.duration) && video.duration > 0;
  const longVideo = () => hasDuration() && video.duration >= 3600;

  /* ---------- Play / pause ---------- */

  function togglePlay({ flash = false } = {}) {
    if (!ctx.source) return;
    if (video.paused || video.ended) {
      video.play().catch((err) => {
        if (err.name !== 'AbortError' && err.name !== 'NotSupportedError') {
          console.warn('Lumen: play() failed', err);
        }
      });
    } else {
      video.pause();
    }
    if (flash) flashCenter(video.paused ? 'pause' : 'play');
  }

  function renderPlayState() {
    const paused = video.paused;
    btnPlay.innerHTML = paused ? icons.play : icons.pause;
    const label = paused ? 'Play (K)' : 'Pause (K)';
    btnPlay.setAttribute('aria-label', label);
    btnPlay.title = label;
    player.classList.toggle('is-paused', paused);
    showUI();
  }

  function flashCenter(iconName) {
    centerIcon.innerHTML = icons[iconName];
    centerIcon.classList.remove('is-animating');
    void centerIcon.offsetWidth; // restart the CSS animation
    centerIcon.classList.add('is-animating');
  }

  function flashSeek(side, text) {
    const el = side === 'left' ? $('#seekFlashLeft') : $('#seekFlashRight');
    el.querySelector('span').textContent = text;
    el.classList.remove('is-animating');
    void el.offsetWidth;
    el.classList.add('is-animating');
  }

  btnPlay.addEventListener('click', () => togglePlay());
  ['play', 'pause', 'ended', 'emptied'].forEach((type) => video.addEventListener(type, renderPlayState));

  /* ---------- Seeking ---------- */

  function seekTo(time) {
    if (!hasDuration()) return;
    video.currentTime = clamp(time, 0, video.duration);
    renderProgress();
    showUI();
  }

  function seekBy(delta) {
    if (!hasDuration()) return;
    seekTo(video.currentTime + delta);
    flashSeek(delta < 0 ? 'left' : 'right', `${delta < 0 ? '−' : '+'}${Math.abs(delta)} s`);
  }

  const seekToFraction = (fraction) => hasDuration() && seekTo(fraction * video.duration);

  $('#btnBack').addEventListener('click', () => seekBy(-10));
  $('#btnForward').addEventListener('click', () => seekBy(10));

  /* ---------- Click / double-click on the video ---------- */

  let clickTimer = 0;
  // Drawing and panning (zoom) also use the stage: their gestures are not clicks.
  const stageBusy = () => ctx.isDrawing?.() || ctx.wasPanning?.();

  stage.addEventListener('click', () => {
    if (!ctx.source || wasMenuJustClosed() || stageBusy()) return;
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => togglePlay({ flash: true }), CLICK_DELAY_MS);
  });

  stage.addEventListener('dblclick', (event) => {
    clearTimeout(clickTimer);
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

  function renderProgress() {
    const duration = hasDuration() ? video.duration : 0;
    const current = scrubbing ? scrubTime : video.currentTime;
    const pct = duration ? clamp((current / duration) * 100, 0, 100) : 0;
    played.style.width = `${pct}%`;
    thumb.style.left = `${pct}%`;
    timeCurrent.textContent = formatTime(current, longVideo());
    progress.setAttribute('aria-valuenow', String(Math.floor(current)));
    progress.setAttribute('aria-valuetext', `${formatTime(current)} of ${formatTime(duration)}`);
  }

  function renderBuffered() {
    if (!hasDuration()) { buffered.style.width = '0'; return; }
    const ranges = video.buffered;
    const t = video.currentTime;
    let end = 0;
    for (let i = 0; i < ranges.length; i++) {
      if (ranges.start(i) <= t + 0.5 && ranges.end(i) >= t) { end = ranges.end(i); break; }
    }
    buffered.style.width = `${clamp((end / video.duration) * 100, 0, 100)}%`;
  }

  function renderDuration() {
    timeDuration.textContent = formatTime(video.duration, longVideo());
    progress.setAttribute('aria-valuemax', String(Math.floor(hasDuration() ? video.duration : 0)));
    renderProgress();
    renderBuffered();
  }

  video.addEventListener('timeupdate', () => { renderProgress(); renderBuffered(); });
  video.addEventListener('progress', renderBuffered);
  ['durationchange', 'loadedmetadata', 'emptied'].forEach((type) => video.addEventListener(type, renderDuration));

  // Smooth progress while playing (timeupdate only fires ~4 times per second).
  let rafId = 0;
  const tick = () => { renderProgress(); rafId = requestAnimationFrame(tick); };
  video.addEventListener('playing', () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(tick); });
  ['pause', 'waiting', 'ended', 'emptied'].forEach((type) =>
    video.addEventListener(type, () => cancelAnimationFrame(rafId)));

  const fractionAt = (clientX) => {
    const rect = track.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  };

  function updateBubble(clientX) {
    if (!hasDuration()) return;
    const fraction = fractionAt(clientX);
    bubble.textContent = formatTime(fraction * video.duration, longVideo());
    const width = progress.clientWidth;
    const half = bubble.offsetWidth / 2;
    bubble.style.left = `${clamp(fraction * width, half, width - half)}px`;
  }

  function scrubTo(clientX) {
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
  const endScrub = () => {
    if (!scrubbing) return;
    scrubbing = false;
    player.classList.remove('is-scrubbing');
    if (!progress.matches(':hover')) progress.classList.remove('is-hovering');
    renderProgress();
    showUI();
  };
  progress.addEventListener('pointerup', endScrub);
  progress.addEventListener('pointercancel', endScrub);
  progress.addEventListener('pointerenter', () => progress.classList.add('is-hovering'));
  progress.addEventListener('pointerleave', () => { if (!scrubbing) progress.classList.remove('is-hovering'); });
  progress.addEventListener('keydown', (event) => {
    if (event.key === 'Home') { seekTo(0); event.preventDefault(); }
    if (event.key === 'End') { seekTo(video.duration); event.preventDefault(); }
  });

  /* ---------- Volume ---------- */

  let lastAudibleVolume = 1;

  function setVolume(value) {
    const volume = clamp(Math.round(value * 100) / 100, 0, 1);
    video.volume = volume;
    if (volume > 0) video.muted = false;
  }

  function changeVolume(delta) {
    const base = video.muted ? 0 : video.volume;
    setVolume(base + delta);
    showToast(`Volume ${Math.round((video.muted ? 0 : video.volume) * 100)}%`);
  }

  function toggleMute({ announce = false } = {}) {
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) video.volume = lastAudibleVolume || 0.5;
    } else {
      video.muted = true;
    }
    if (announce) showToast(video.muted ? 'Muted' : `Volume ${Math.round(video.volume * 100)}%`);
  }

  let saveVolumeTimer = 0;
  function renderVolume() {
    const level = video.muted ? 0 : video.volume;
    if (video.volume > 0) lastAudibleVolume = video.volume;
    volumeSlider.value = String(Math.round(level * 100));
    volumeSlider.style.setProperty('--fill', `${level * 100}%`);
    volumeSlider.setAttribute('aria-valuetext', `${Math.round(level * 100)}%`);
    btnMute.innerHTML = level === 0 ? icons.volumeMute : level < 0.5 ? icons.volumeLow : icons.volumeHigh;
    const label = level === 0 ? 'Unmute (M)' : 'Mute (M)';
    btnMute.setAttribute('aria-label', label);
    btnMute.title = label;
    clearTimeout(saveVolumeTimer);
    saveVolumeTimer = setTimeout(() => saveSetting('volume', { level: video.volume, muted: video.muted }), 300);
  }

  btnMute.addEventListener('click', () => toggleMute());
  volumeSlider.addEventListener('input', () => setVolume(Number(volumeSlider.value) / 100));
  video.addEventListener('volumechange', renderVolume);
  renderVolume();
  loadSetting('volume', { level: 1, muted: false }).then((saved) => {
    video.volume = clamp(Number(saved?.level ?? 1), 0, 1);
    video.muted = Boolean(saved?.muted);
    renderVolume();
  });

  /* ---------- Fullscreen ---------- */

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      player.requestFullscreen().catch(() => showToast('Fullscreen is not available here'));
    }
  }

  function exitFullscreen() {
    if (!document.fullscreenElement) return false;
    document.exitFullscreen().catch(() => {});
    return true;
  }

  function renderFullscreen() {
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

  async function togglePip() {
    if (!document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      showToast('Picture-in-Picture is not available for this video');
    }
  }

  const renderPip = () => {
    btnPip.disabled = video.readyState < HTMLMediaElement.HAVE_METADATA || !video.videoWidth;
    btnPip.classList.toggle('is-active', document.pictureInPictureElement === video);
  };

  if (!document.pictureInPictureEnabled) btnPip.hidden = true;
  btnPip.addEventListener('click', togglePip);
  ['loadedmetadata', 'emptied', 'enterpictureinpicture', 'leavepictureinpicture'].forEach((type) =>
    video.addEventListener(type, renderPip));
  renderPip();

  /* ---------- Loading spinner ---------- */

  let spinnerTimer = 0;
  const showSpinner = () => {
    clearTimeout(spinnerTimer);
    spinnerTimer = setTimeout(() => { spinner.hidden = false; }, 350);
  };
  const hideSpinner = () => { clearTimeout(spinnerTimer); spinner.hidden = true; };
  ['waiting', 'seeking'].forEach((type) => video.addEventListener(type, showSpinner));
  ['playing', 'canplay', 'seeked', 'pause', 'error', 'emptied', 'loadeddata'].forEach((type) =>
    video.addEventListener(type, hideSpinner));

  /* ---------- Auto-hide ---------- */

  let hideTimer = 0;
  let pointerOverControls = false;

  function showUI() {
    player.classList.remove('ui-hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideUI, HIDE_DELAY_MS);
  }

  function hideUI() {
    if (!ctx.source || video.paused || scrubbing || pointerOverControls || anyMenuOpen()) return;
    player.classList.add('ui-hidden');
  }

  player.addEventListener('pointermove', (event) => {
    if (event.movementX === 0 && event.movementY === 0) return; // ignore synthetic moves
    showUI();
  });
  player.addEventListener('pointerleave', () => {
    if (video.paused) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideUI, 700);
  });
  controls.addEventListener('pointerenter', () => { pointerOverControls = true; showUI(); });
  controls.addEventListener('pointerleave', () => { pointerOverControls = false; showUI(); });
  controls.addEventListener('focusin', showUI);
  onMenuChange(showUI);

  renderPlayState();

  return {
    togglePlay, seekBy, seekTo, seekToFraction, changeVolume, toggleMute,
    toggleFullscreen, exitFullscreen, togglePip, showUI, flashCenter,
  };
}
