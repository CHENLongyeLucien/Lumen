// Entry point: creates the shared context and wires all player modules.

import { initAnnotate } from './annotate';
import { initAppearance } from './appearance';
import { createContext } from './context';
import { initControls } from './controls';
import { initDetails } from './details';
import { initLoop } from './ab-loop';
import { initFrames } from './frames';
import { initPositionMemory } from './position-memory';
import { createScreenshot } from './screenshot';
import { injectIcons } from './icons';
import { initLayout } from './layout';
import { initSettings } from './settings';
import { initShortcuts } from './shortcuts';
import { initSource } from './source';
import { initSpeed } from './speed';
import { initSubtitles } from './subtitles';
import { $, $as, closeAllMenus } from './utils';
import { initZoom } from './zoom';

injectIcons();

const ctx = createContext($('#app'), $('#player'), $as('#video', HTMLVideoElement));

initAppearance();
const layout = initLayout(ctx);
const controls = initControls(ctx);
const speed = initSpeed(ctx);
const subtitles = initSubtitles(ctx);
const loop = initLoop(ctx);
const frames = initFrames(ctx, { showUI: controls.showUI, onFrame: loop.enforce });
initPositionMemory(ctx, { isLooping: loop.isLooping });
const screenshot = createScreenshot(ctx);
const annotate = initAnnotate(ctx, { showUI: controls.showUI });
const zoom = initZoom(ctx, { showUI: controls.showUI });
const details = initDetails(ctx, { getFrameRate: frames.getFrameRate });
const settings = initSettings(ctx, {
  screenshot,
  infoRows: details.infoRows,
  zoomIn: zoom.zoomIn,
});
ctx.drawAnnotations = annotate.drawOnto;
$('#actScreenshot').addEventListener('click', () => {
  void screenshot();
});

const source = initSource(ctx, {
  onSubtitleFile: (file) => {
    void subtitles.loadFile(file);
  },
});

initShortcuts({
  hasSource: source.isShowingVideo,
  togglePlay: controls.togglePlay,
  seekBy: controls.seekBy,
  seekToFraction: controls.seekToFraction,
  changeVolume: controls.changeVolume,
  toggleMute: controls.toggleMute,
  toggleFullscreen: controls.toggleFullscreen,
  togglePip: () => {
    void controls.togglePip();
  },
  toggleTheater: layout.toggleTheater,
  toggleDraw: annotate.toggle,
  toggleSubtitles: () => {
    subtitles.toggle();
  },
  zoomIn: zoom.zoomIn,
  zoomOut: zoom.zoomOut,
  stepSpeed: speed.stepSpeed,
  stepFrame: frames.stepFrame,
  // Esc: close a menu, the info panel, the drawing tools, then leave fullscreen.
  escape: () => closeAllMenus() || settings.closeInfo() || annotate.exit() || controls.exitFullscreen(),
});
