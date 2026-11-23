// Screenshot of the current frame (with image filters and drawings) as a PNG download.

import type { PlayerContext } from './context';
import { formatTime } from './format';
import { showToast } from './utils';

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // toBlob throws a SecurityError for frames from another origin (tainted canvas).
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Empty image'));
    }, 'image/png');
  });
}

function download(blob: Blob, fileName: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(link.href);
  }, 10000);
}

/** Returns the screenshot action for this player. */
export function createScreenshot(ctx: PlayerContext): () => Promise<void> {
  const { video } = ctx;

  return async function screenshot(): Promise<void> {
    if (!video.videoWidth) {
      showToast('No image to capture yet');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const g = canvas.getContext('2d');
    if (!g) {
      showToast('Screenshot failed');
      return;
    }
    g.filter = ctx.imageFilter || 'none';
    g.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.drawAnnotations?.(g, canvas.width, canvas.height); // include the user's drawing
    try {
      const blob = await canvasToPng(canvas);
      const base = (ctx.source?.name ?? 'lumen').replace(/\.[^.]+$/, '');
      const long = Number.isFinite(video.duration) && video.duration >= 3600;
      const time = formatTime(video.currentTime, long).replace(/:/g, '-');
      download(blob, `${base}_${time}.png`);
      showToast('Screenshot saved');
    } catch (err) {
      console.warn('Lumen: screenshot failed', err);
      showToast(
        err instanceof DOMException && err.name === 'SecurityError'
          ? 'This video comes from another site that does not allow screenshots'
          : 'Screenshot failed',
      );
    }
  };
}
