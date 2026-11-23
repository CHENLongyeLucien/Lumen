// Entry point: creates the shared context and wires all player modules.

import { initAnnotate } from './annotate';
import { initAppearance } from './appearance';
import { createContext } from './context';
import { initControls } from './controls';
import { initDetails } from './details';
import { initExtras } from './extras';
import { injectIcons } from './icons';
import { initLayout } from './layout';
import { initSettings } from './settings';
import { initShortcuts } from './shortcuts';
import { initSource } from './source';
import { initSpeed } from './speed';
import { initSubtitles } from './subtitles';
import { $, closeAllMenus } from './utils';
import { initZoom } from './zoom';

injectIcons();

const ctx = createContext($('#app'), $('#player'), $<HTMLVideoElement>('#video'));

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
$('#actScreenshot').addEventListener('click', () => {
  void extras.screenshot();
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
  stepFrame: extras.stepFrame,
  // Esc: close a menu, the info panel, the drawing tools, then leave fullscreen.
  escape: () => closeAllMenus() || settings.closeInfo() || annotate.exit() || controls.exitFullscreen(),
});
