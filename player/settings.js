// Settings menu: screenshot, subtitles, info panel, rotation, mirror and
// image adjustments (CSS filters).

import { $, setupMenu } from './utils.js';

const DEFAULT_IMAGE = { rotation: 0, mirror: false, brightness: 100, contrast: 100, saturation: 100 };

export function initSettings(ctx, { screenshot, infoRows, zoomIn }) {
  const { video } = ctx;
  const stage = $('#stage');
  const menu = $('#settingsMenu');
  const menuApi = setupMenu($('#btnSettings'), menu);
  const image = { ...DEFAULT_IMAGE };

  /* ---------- Image: rotation, mirror, filters ---------- */

  // Rotation is cumulative (0, 90, 180, 270, 360…) so the CSS transition always turns clockwise.
  const isQuarterTurn = () => (image.rotation / 90) % 2 === 1;

  function applyImage() {
    const { brightness, contrast, saturation } = image;
    const neutral = brightness === 100 && contrast === 100 && saturation === 100;
    const filter = neutral ? '' : `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    video.style.filter = filter;
    ctx.imageFilter = filter || 'none';

    if (isQuarterTurn()) {
      // Swap the box so object-fit: contain still fits once rotated.
      const { width, height } = stage.getBoundingClientRect();
      video.style.width = `${height}px`;
      video.style.height = `${width}px`;
    } else {
      video.style.width = '';
      video.style.height = '';
    }
    video.style.transform = `translate(-50%, -50%) scaleX(${image.mirror ? -1 : 1}) rotate(${image.rotation}deg)`;
    renderImageControls();
    ctx.redrawAnnotations?.(); // drawings follow the picture's new shape
  }

  function renderImageControls() {
    $('#rotateValue').textContent = `${image.rotation % 360}°`;
    $('#mirrorValue').textContent = image.mirror ? 'On' : 'Off';
    menu.querySelector('[data-action="mirror"]').setAttribute('aria-checked', String(image.mirror));
    for (const slider of menu.querySelectorAll('[data-filter]')) {
      const value = image[slider.dataset.filter];
      slider.value = String(value);
      slider.style.setProperty('--fill', `${value / 2}%`);
      menu.querySelector(`[data-value-for="${slider.dataset.filter}"]`).textContent = `${value}%`;
    }
  }

  new ResizeObserver(() => { if (isQuarterTurn()) applyImage(); }).observe(stage);

  menu.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    switch (action) {
      case 'screenshot': menuApi.close(); screenshot(); break;
      case 'zoom': zoomIn(); break;
      case 'info': menuApi.close(); openInfo(); break;
      case 'rotate': image.rotation += 90; applyImage(); break;
      case 'mirror': image.mirror = !image.mirror; applyImage(); break;
      case 'reset-image': Object.assign(image, DEFAULT_IMAGE); applyImage(); break;
      default: break;
    }
  });

  menu.addEventListener('input', (event) => {
    const key = event.target.dataset?.filter;
    if (!key) return;
    image[key] = Number(event.target.value);
    applyImage();
  });

  /* ---------- Info panel ---------- */

  const panel = $('#infoPanel');
  const list = $('#infoList');

  function renderInfo() {
    list.replaceChildren(...infoRows().flatMap(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      return [dt, dd];
    }));
  }

  function openInfo() {
    renderInfo();
    panel.hidden = false;
    $('#btnInfoClose').focus({ preventScroll: true });
  }

  function closeInfo() {
    if (panel.hidden) return false;
    panel.hidden = true;
    return true;
  }

  $('#btnInfoClose').addEventListener('click', closeInfo);
  ['loadedmetadata', 'durationchange'].forEach((type) =>
    video.addEventListener(type, () => { if (!panel.hidden) renderInfo(); }));
  ctx.events.addEventListener('sourcechange', closeInfo);

  ctx.isQuarterTurn = isQuarterTurn;
  applyImage();
  return { closeInfo };
}
