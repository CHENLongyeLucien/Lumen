// Drawing on the video: pen, highlighter, eraser, colors, size, undo, clear.
// Strokes are stored in coordinates relative to the video picture (0..1),
// so they stay in place when the window is resized or the video zoomed.

import type { PlayerContext } from './context';
import { isTool, renderStrokes, type Point, type Rect, type Stroke, type Tool } from './strokes';
import { $, $as, clamp, showToast } from './utils';

const COLORS = ['#ff4d4f', '#ffb454', '#ffe066', '#34d399', '#4c9aff', '#a78bfa', '#ffffff', '#111111'];

export interface AnnotateApi {
  toggle: () => void;
  exit: () => boolean;
  drawOnto: (target: CanvasRenderingContext2D, width: number, height: number) => void;
}

export function initAnnotate(ctx: PlayerContext, { showUI }: { showUI: () => void }): AnnotateApi {
  const { video, player } = ctx;
  const canvas = $as('#drawCanvas', HTMLCanvasElement);
  const view = $('#view');
  const toolbar = $('#drawToolbar');
  const colorsBox = $('#drawColors');
  const sizeInput = $as('#drawSize', HTMLInputElement);
  const drawButtons = [$('#btnDraw'), $('#actDraw')];
  const context2d = canvas.getContext('2d');
  if (!context2d) throw new Error('Lumen: 2D canvas unavailable');
  const g = context2d;

  const strokes: Stroke[] = [];
  const state: { active: boolean; tool: Tool; color: string; size: number } = {
    active: false,
    tool: 'pen',
    color: COLORS[0] ?? '#ff4d4f',
    size: 4,
  };
  let current: Stroke | null = null;
  let frameRequested = false;

  /** Rectangle of the visible picture inside the canvas (CSS pixels), like object-fit: contain. */
  function pictureRect(width: number, height: number): Rect {
    let vw = video.videoWidth || 16;
    let vh = video.videoHeight || 9;
    if (ctx.isQuarterTurn?.()) [vw, vh] = [vh, vw];
    const scale = Math.min(width / vw, height / vh);
    return { x: (width - vw * scale) / 2, y: (height - vh * scale) / 2, w: vw * scale, h: vh * scale };
  }

  function redraw(): void {
    frameRequested = false;
    const dpr = window.devicePixelRatio || 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderStrokes(g, strokes, pictureRect(canvas.clientWidth, canvas.clientHeight));
  }
  const requestRedraw = (): void => {
    if (!frameRequested) {
      frameRequested = true;
      requestAnimationFrame(redraw);
    }
  };

  function resize(): void {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    redraw();
  }
  new ResizeObserver(resize).observe(canvas);
  video.addEventListener('loadedmetadata', requestRedraw);

  /** Pointer position → picture coordinates (0..1). The view is only translated/scaled, never rotated. */
  function toPicture(event: PointerEvent): Point {
    const bounds = view.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * canvas.clientWidth;
    const y = ((event.clientY - bounds.top) / bounds.height) * canvas.clientHeight;
    const rect = pictureRect(canvas.clientWidth, canvas.clientHeight);
    return { x: (x - rect.x) / rect.w, y: (y - rect.y) / rect.h };
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!state.active || event.button !== 0) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    current = { tool: state.tool, color: state.color, size: state.size, points: [toPicture(event)] };
    strokes.push(current);
    requestRedraw();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!current) return;
    const stroke = current;
    for (const e of event.getCoalescedEvents()) stroke.points.push(toPicture(e));
    if (!event.getCoalescedEvents().length) stroke.points.push(toPicture(event));
    requestRedraw();
  });
  const endStroke = (): void => {
    current = null;
  };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  /* ---------- Toolbar ---------- */

  function renderToolbar(): void {
    toolbar.querySelectorAll<HTMLElement>('[data-tool]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.tool === state.tool));
    });
    colorsBox.querySelectorAll<HTMLElement>('[data-color]').forEach((btn) => {
      btn.setAttribute('aria-checked', String(btn.dataset.color === state.color && state.tool !== 'eraser'));
    });
    sizeInput.value = String(state.size);
    sizeInput.style.setProperty('--fill', `${String(((state.size - 1) / 23) * 100)}%`);
  }

  for (const color of COLORS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'draw-color';
    btn.dataset.color = color;
    btn.style.setProperty('--swatch', color);
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-label', `Color ${color}`);
    btn.addEventListener('click', () => {
      state.color = color;
      if (state.tool === 'eraser') state.tool = 'pen';
      renderToolbar();
    });
    colorsBox.append(btn);
  }

  toolbar.querySelectorAll<HTMLElement>('[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      if (isTool(tool)) state.tool = tool;
      renderToolbar();
    });
  });
  sizeInput.addEventListener('input', () => {
    state.size = clamp(Number(sizeInput.value), 1, 24);
    renderToolbar();
  });

  function undo(): void {
    if (strokes.pop()) requestRedraw();
  }

  function clear(): void {
    if (!strokes.length) return;
    strokes.length = 0;
    requestRedraw();
    showToast('Drawing cleared');
  }

  $('#drawUndo').addEventListener('click', undo);
  $('#drawClear').addEventListener('click', clear);
  $('#drawDone').addEventListener('click', () => {
    setActive(false);
  });

  /* ---------- Mode ---------- */

  function setActive(on: boolean): void {
    if (on && !ctx.source) return;
    state.active = on;
    toolbar.hidden = !on;
    player.classList.toggle('is-drawing', on);
    for (const btn of drawButtons) {
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-active', on);
    }
    if (on) showToast('Draw on the video · Ctrl+Z to undo · Esc when done', 2500);
    showUI();
  }

  const toggle = (): void => {
    setActive(!state.active);
  };
  /** Esc handler: returns true if it closed the drawing mode. */
  function exit(): boolean {
    if (!state.active) return false;
    setActive(false);
    return true;
  }

  for (const btn of drawButtons) btn.addEventListener('click', toggle);

  document.addEventListener('keydown', (event) => {
    if (state.active && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
    }
  });

  // A drawing belongs to one video.
  ctx.onSourceChange(() => {
    strokes.length = 0;
    requestRedraw();
  });

  /** Paints the drawing on a screenshot of size width × height (video pixels). */
  function drawOnto(target: CanvasRenderingContext2D, width: number, height: number): void {
    if (!strokes.length) return;
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    const layerContext = layer.getContext('2d');
    if (!layerContext) return;
    renderStrokes(layerContext, strokes, { x: 0, y: 0, w: width, h: height });
    target.filter = 'none';
    target.drawImage(layer, 0, 0);
  }

  ctx.isDrawing = () => state.active;
  ctx.redrawAnnotations = requestRedraw;
  renderToolbar();

  return { toggle, exit, drawOnto };
}
