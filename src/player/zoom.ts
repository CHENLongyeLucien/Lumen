// Zoom and pan: Ctrl + wheel (or trackpad pinch), + / - keys, buttons.
// While zoomed, drag the video to move around; the wheel zooms too.

import type { PlayerContext } from './context';
import { $, clamp, closestTarget } from './utils';

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const STEP = 1.25;
const DRAG_THRESHOLD = 4; // px before a press becomes a pan instead of a click

export interface ZoomApi {
  zoomIn(): void;
  zoomOut(): void;
  reset(): void;
}

interface Drag {
  x: number;
  y: number;
  panX: number;
  panY: number;
  moved: boolean;
  id: number;
}

export function initZoom(ctx: PlayerContext, { showUI }: { showUI: () => void }): ZoomApi {
  const { player } = ctx;
  const stage = $('#stage');
  const view = $('#view');
  const chip = $('#zoomChip');
  const valueLabel = $('#zoomValue');

  let zoom = 1;
  let panX = 0;
  let panY = 0;

  function clampPan(): void {
    const { width, height } = stage.getBoundingClientRect();
    const maxX = ((zoom - 1) * width) / 2;
    const maxY = ((zoom - 1) * height) / 2;
    panX = clamp(panX, -maxX, maxX);
    panY = clamp(panY, -maxY, maxY);
  }

  function apply({ animate = true }: { animate?: boolean } = {}): void {
    clampPan();
    view.style.transition = animate ? '' : 'none';
    view.style.transform =
      zoom === 1 ? '' : `translate(${String(panX)}px, ${String(panY)}px) scale(${String(zoom)})`;
    chip.hidden = zoom === 1;
    valueLabel.textContent = `${String(Math.round(zoom * 100))}%`;
    player.classList.toggle('is-zoomed', zoom > 1);
  }

  /** Zooms keeping the point under (clientX, clientY) fixed; defaults to the center. */
  function zoomTo(newZoom: number, clientX?: number, clientY?: number, options?: { animate?: boolean }): void {
    const rect = stage.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const px = clientX ?? cx;
    const py = clientY ?? cy;
    const next = clamp(newZoom, MIN_ZOOM, MAX_ZOOM);
    // screen = center + pan + local * zoom  →  keep `local` under the cursor constant
    const localX = (px - cx - panX) / zoom;
    const localY = (py - cy - panY) / zoom;
    zoom = next;
    panX = px - cx - localX * zoom;
    panY = py - cy - localY * zoom;
    if (zoom === 1) {
      panX = 0;
      panY = 0;
    }
    apply(options);
    showUI();
  }

  const zoomIn = (): void => {
    if (ctx.source) zoomTo(zoom * STEP);
  };
  const zoomOut = (): void => {
    if (ctx.source) zoomTo(zoom / STEP);
  };
  const reset = (): void => {
    zoomTo(1);
  };

  stage.addEventListener(
    'wheel',
    (event) => {
      if (!ctx.source || (!event.ctrlKey && zoom === 1)) return; // plain wheel scrolls the page
      event.preventDefault();
      zoomTo(zoom * Math.exp(-event.deltaY * 0.0025), event.clientX, event.clientY, { animate: false });
    },
    { passive: false },
  );

  /* ---------- Panning ---------- */

  let drag: Drag | null = null;
  let lastPanAt = 0;
  ctx.wasPanning = () => performance.now() - lastPanAt < 250;

  stage.addEventListener('pointerdown', (event) => {
    if (zoom === 1 || event.button !== 0 || ctx.isDrawing?.()) return;
    drag = { x: event.clientX, y: event.clientY, panX, panY, moved: false, id: event.pointerId };
  });
  stage.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!drag.moved) {
      drag.moved = true;
      stage.setPointerCapture(event.pointerId);
      player.classList.add('is-panning');
    }
    panX = drag.panX + dx;
    panY = drag.panY + dy;
    apply({ animate: false });
  });
  const endDrag = (): void => {
    if (drag?.moved) lastPanAt = performance.now();
    drag = null;
    player.classList.remove('is-panning');
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  chip.addEventListener('click', (event) => {
    const action = closestTarget(event.target, '[data-zoom]')?.dataset.zoom;
    if (action === 'in') zoomIn();
    else if (action === 'out') zoomOut();
    else if (action === 'reset') reset();
  });
  $('#actZoom').addEventListener('click', zoomIn);

  new ResizeObserver(() => {
    apply({ animate: false });
  }).observe(stage);
  ctx.onSourceChange(() => {
    zoom = 1;
    panX = 0;
    panY = 0;
    apply({ animate: false });
  });

  return { zoomIn, zoomOut, reset };
}
