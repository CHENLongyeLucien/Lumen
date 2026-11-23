// Drawing on the video: pen, highlighter, eraser, colors, size, undo, clear.
// Strokes are stored in coordinates relative to the video picture (0..1),
// so they stay in place when the window is resized or the video zoomed.

import { $, clamp, showToast } from './utils.js';

const COLORS = ['#ff4d4f', '#ffb454', '#ffe066', '#34d399', '#4c9aff', '#a78bfa', '#ffffff', '#111111'];
const TOOL_SETTINGS = {
  pen: { alpha: 1, widthFactor: 1, composite: 'source-over' },
  highlighter: { alpha: 0.35, widthFactor: 4, composite: 'source-over' },
  eraser: { alpha: 1, widthFactor: 4, composite: 'destination-out' },
};

/** Draws strokes into a 2D context, inside the picture rectangle `rect` (canvas pixels). */
function renderStrokes(g, strokes, rect) {
  for (const stroke of strokes) {
    const tool = TOOL_SETTINGS[stroke.tool];
    g.save();
    g.globalCompositeOperation = tool.composite;
    g.globalAlpha = tool.alpha;
    g.strokeStyle = stroke.color;
    g.lineWidth = Math.max(1, stroke.size * tool.widthFactor * (rect.h / 600));
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    stroke.points.forEach((p, i) => {
      const x = rect.x + p.x * rect.w;
      const y = rect.y + p.y * rect.h;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    });
    if (stroke.points.length === 1) g.lineTo(rect.x + stroke.points[0].x * rect.w + 0.01, rect.y + stroke.points[0].y * rect.h);
    g.stroke();
    g.restore();
  }
}

export function initAnnotate(ctx, { showUI }) {
  const { video, player } = ctx;
  const canvas = $('#drawCanvas');
  const view = $('#view');
  const toolbar = $('#drawToolbar');
  const colorsBox = $('#drawColors');
  const sizeInput = $('#drawSize');
  const g = canvas.getContext('2d');

  const strokes = [];
  const state = { active: false, tool: 'pen', color: COLORS[0], size: 4 };
  let current = null;
  let frameRequested = false;

  /** Rectangle of the visible picture inside the canvas (CSS pixels), like object-fit: contain. */
  function pictureRect(width, height) {
    let vw = video.videoWidth || 16;
    let vh = video.videoHeight || 9;
    if (ctx.isQuarterTurn?.()) [vw, vh] = [vh, vw];
    const scale = Math.min(width / vw, height / vh);
    return { x: (width - vw * scale) / 2, y: (height - vh * scale) / 2, w: vw * scale, h: vh * scale };
  }

  function redraw() {
    frameRequested = false;
    const dpr = window.devicePixelRatio || 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderStrokes(g, strokes, pictureRect(canvas.clientWidth, canvas.clientHeight));
  }
  const requestRedraw = () => {
    if (!frameRequested) {
      frameRequested = true;
      requestAnimationFrame(redraw);
    }
  };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    redraw();
  }
  new ResizeObserver(resize).observe(canvas);
  video.addEventListener('loadedmetadata', requestRedraw);

  /** Pointer position → picture coordinates (0..1). The view is only translated/scaled, never rotated. */
  function toPicture(event) {
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
    const events = event.getCoalescedEvents?.() ?? [event];
    for (const e of events) current.points.push(toPicture(e));
    requestRedraw();
  });
  const endStroke = () => { current = null; };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  /* ---------- Toolbar ---------- */

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

  toolbar.querySelectorAll('[data-tool]').forEach((btn) =>
    btn.addEventListener('click', () => { state.tool = btn.dataset.tool; renderToolbar(); }));
  sizeInput.addEventListener('input', () => {
    state.size = clamp(Number(sizeInput.value), 1, 24);
    renderToolbar();
  });
  $('#drawUndo').addEventListener('click', undo);
  $('#drawClear').addEventListener('click', clear);
  $('#drawDone').addEventListener('click', () => setActive(false));

  function renderToolbar() {
    toolbar.querySelectorAll('[data-tool]').forEach((btn) =>
      btn.setAttribute('aria-pressed', String(btn.dataset.tool === state.tool)));
    for (const btn of colorsBox.children) {
      btn.setAttribute('aria-checked', String(btn.dataset.color === state.color && state.tool !== 'eraser'));
    }
    sizeInput.value = String(state.size);
    sizeInput.style.setProperty('--fill', `${((state.size - 1) / 23) * 100}%`);
  }

  function undo() {
    if (strokes.pop()) requestRedraw();
  }

  function clear() {
    if (!strokes.length) return;
    strokes.length = 0;
    requestRedraw();
    showToast('Drawing cleared');
  }

  /* ---------- Mode ---------- */

  function setActive(on) {
    if (on && !ctx.source) return;
    state.active = on;
    toolbar.hidden = !on;
    player.classList.toggle('is-drawing', on);
    for (const btn of [$('#btnDraw'), $('#actDraw')]) {
      btn.setAttribute('aria-pressed', String(on));
      btn.classList.toggle('is-active', on);
    }
    if (on) showToast('Draw on the video · Ctrl+Z to undo · Esc when done', 2500);
    showUI();
  }

  const toggle = () => setActive(!state.active);
  /** Esc handler: returns true if it closed the drawing mode. */
  function exit() {
    if (!state.active) return false;
    setActive(false);
    return true;
  }

  $('#btnDraw').addEventListener('click', toggle);
  $('#actDraw').addEventListener('click', toggle);

  document.addEventListener('keydown', (event) => {
    if (state.active && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      undo();
    }
  });

  // A drawing belongs to one video.
  ctx.events.addEventListener('sourcechange', () => {
    strokes.length = 0;
    requestRedraw();
  });

  /** Paints the drawing on a screenshot of size width × height (video pixels). */
  function drawOnto(target, width, height) {
    if (!strokes.length) return;
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    renderStrokes(layer.getContext('2d'), strokes, { x: 0, y: 0, w: width, h: height });
    target.filter = 'none';
    target.drawImage(layer, 0, 0);
  }

  ctx.isDrawing = () => state.active;
  ctx.redrawAnnotations = requestRedraw;
  renderToolbar();

  return { toggle, exit, drawOnto };
}
