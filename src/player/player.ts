// Entry point: creates the shared context and wires all player modules.

import { $, closeAllMenus } from './utils.js';
import { injectIcons } from './icons.js';
import { initAppearance } from './appearance.js';
import { initLayout } from './layout.js';
import { initControls } from './controls.js';
import { initSpeed } from './speed.js';
import { initShortcuts } from './shortcuts.js';
import { initSubtitles } from './subtitles.js';
import { initExtras } from './extras.js';
import { initAnnotate } from './annotate.js';
import { initZoom } from './zoom.js';
import { initDetails } from './details.js';
import { initSettings } from './settings.js';
import { initSource } from './source.js';

injectIcons();

/** Shared state passed to every module. */
const ctx = {
  app: $('#app'),
  player: $('#player'), // the element that goes fullscreen
  video: $('#video'),
  source: null, // { url, name, key, type, size?, modified?, kind, ext }
  imageFilter: 'none',
  events: new EventTarget(), // emits "sourcechange"
};

initAppearance();
const layout = initLayout(ctx);
const controls = initControls(ctx);
const speed = initSpeed(ctx);
const subtitles = initSubtitles(ctx);
const extras = initExtras(ctx, { showUI: controls.showUI });
const annotate = initAnnotate(ctx, { showUI: controls.showUI });
const zoom = initZoom(ctx, { showUI: controls.showUI });
const details = initDetails(ctx, { getFrameRate: extras.getFrameRate });
const settings = initSettings(ctx, {
  screenshot: extras.screenshot,
  infoRows: details.infoRows,
  zoomIn: zoom.zoomIn,
});
ctx.drawAnnotations = annotate.drawOnto;
$('#actScreenshot').addEventListener('click', extras.screenshot);

const source = initSource(ctx, { onSubtitleFile: subtitles.loadFile });

initShortcuts({
  hasSource: source.isShowingVideo,
  togglePlay: controls.togglePlay,
  seekBy: controls.seekBy,
  seekToFraction: controls.seekToFraction,
  changeVolume: controls.changeVolume,
  toggleMute: controls.toggleMute,
  toggleFullscreen: controls.toggleFullscreen,
  togglePip: controls.togglePip,
  toggleTheater: layout.toggleTheater,
  toggleDraw: annotate.toggle,
  toggleSubtitles: subtitles.toggle,
  zoomIn: zoom.zoomIn,
  zoomOut: zoom.zoomOut,
  stepSpeed: speed.stepSpeed,
  stepFrame: extras.stepFrame,
  // Esc: close a menu, the info panel, the drawing tools, then leave fullscreen.
  escape: () => closeAllMenus() || settings.closeInfo() || annotate.exit() || controls.exitFullscreen(),
});
