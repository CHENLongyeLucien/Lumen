// Settings menu: screenshot, info panel, zoom, rotation, mirror and
// image adjustments (CSS filters).

import type { PlayerContext } from './context';
import { renderDefinitionList, type InfoRow } from './details';
import { $, $as, closestTarget, setupMenu } from './utils';

type FilterName = 'brightness' | 'contrast' | 'saturation';

interface ImageState {
  rotation: number;
  mirror: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
}

const DEFAULT_IMAGE: ImageState = {
  rotation: 0,
  mirror: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
};

const isFilterName = (value: string | undefined): value is FilterName =>
  value === 'brightness' || value === 'contrast' || value === 'saturation';

export interface SettingsApi {
  closeInfo: () => boolean;
}

interface SettingsDeps {
  screenshot: () => Promise<void>;
  infoRows: () => InfoRow[];
  zoomIn: () => void;
}

export function initSettings(
  ctx: PlayerContext,
  { screenshot, infoRows, zoomIn }: SettingsDeps,
): SettingsApi {
  const { video } = ctx;
  const stage = $('#stage');
  const menu = $('#settingsMenu');
  const menuApi = setupMenu($('#btnSettings'), menu);
  const image: ImageState = { ...DEFAULT_IMAGE };

  /* ---------- Image: rotation, mirror, filters ---------- */

  // Rotation is cumulative (0, 90, 180, 270, 360…) so the CSS transition always turns clockwise.
  const isQuarterTurn = (): boolean => (image.rotation / 90) % 2 === 1;

  function applyImage(): void {
    const { brightness, contrast, saturation } = image;
    const neutral = brightness === 100 && contrast === 100 && saturation === 100;
    const filter = neutral
      ? ''
      : `brightness(${String(brightness)}%) contrast(${String(contrast)}%) saturate(${String(saturation)}%)`;
    video.style.filter = filter;
    ctx.imageFilter = filter || 'none';

    if (isQuarterTurn()) {
      // Swap the box so object-fit: contain still fits once rotated.
      const { width, height } = stage.getBoundingClientRect();
      video.style.width = `${String(height)}px`;
      video.style.height = `${String(width)}px`;
    } else {
      video.style.width = '';
      video.style.height = '';
    }
    video.style.transform = `translate(-50%, -50%) scaleX(${image.mirror ? '-1' : '1'}) rotate(${String(image.rotation)}deg)`;
    renderImageControls();
    ctx.redrawAnnotations?.(); // drawings follow the picture's new shape
  }

  function renderImageControls(): void {
    $('#rotateValue').textContent = `${String(image.rotation % 360)}°`;
    $('#mirrorValue').textContent = image.mirror ? 'On' : 'Off';
    $('[data-action="mirror"]', menu).setAttribute('aria-pressed', String(image.mirror));
    for (const slider of menu.querySelectorAll<HTMLInputElement>('input[data-filter]')) {
      const name = slider.dataset.filter;
      if (!isFilterName(name)) continue;
      const value = image[name];
      slider.value = String(value);
      slider.style.setProperty('--fill', `${String(value / 2)}%`);
      $(`[data-value-for="${name}"]`, menu).textContent = `${String(value)}%`;
    }
  }

  new ResizeObserver(() => {
    if (isQuarterTurn()) applyImage();
  }).observe(stage);

  menu.addEventListener('click', (event) => {
    const action = closestTarget(event.target, '[data-action]')?.dataset.action;
    switch (action) {
      case 'screenshot':
        menuApi.close();
        void screenshot();
        break;
      case 'zoom':
        zoomIn();
        break;
      case 'info':
        menuApi.close();
        openInfo();
        break;
      case 'rotate':
        image.rotation += 90;
        applyImage();
        break;
      case 'mirror':
        image.mirror = !image.mirror;
        applyImage();
        break;
      case 'reset-image':
        Object.assign(image, DEFAULT_IMAGE);
        applyImage();
        break;
      default:
        break;
    }
  });

  menu.addEventListener('input', (event) => {
    const slider = event.target;
    if (!(slider instanceof HTMLInputElement)) return;
    const name = slider.dataset.filter;
    if (!isFilterName(name)) return;
    image[name] = Number(slider.value);
    applyImage();
  });

  /* ---------- Info panel ---------- */

  const panel = $('#infoPanel');
  const list = $('#infoList');
  const btnClose = $as('#btnInfoClose', HTMLButtonElement);

  const renderInfo = (): void => {
    renderDefinitionList(list, infoRows());
  };

  function openInfo(): void {
    renderInfo();
    panel.hidden = false;
    btnClose.focus({ preventScroll: true });
  }

  function closeInfo(): boolean {
    if (panel.hidden) return false;
    const hadFocus = panel.contains(document.activeElement);
    panel.hidden = true;
    if (hadFocus) $('#btnSettings').focus({ preventScroll: true }); // back to where it was opened from
    return true;
  }

  btnClose.addEventListener('click', closeInfo);
  for (const type of ['loadedmetadata', 'durationchange']) {
    video.addEventListener(type, () => {
      if (!panel.hidden) renderInfo();
    });
  }
  ctx.onSourceChange(closeInfo);

  ctx.isQuarterTurn = isQuarterTurn;
  applyImage();
  return { closeInfo };
}
