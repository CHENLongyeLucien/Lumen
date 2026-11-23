// Frame rate estimate (requestVideoFrameCallback) and frame-by-frame stepping.

import type { PlayerContext } from './context';
import { clamp } from './format';

const DEFAULT_FRAME = 1 / 30;
const MIN_SAMPLES = 5;

export interface FramesApi {
  stepFrame: (direction: number) => void;
  getFrameRate: () => number | null;
}

interface FramesDeps {
  showUI: () => void;
  /** Called with the media time of every presented frame (precise A-B looping). */
  onFrame: (mediaTime: number) => void;
}

export function initFrames(ctx: PlayerContext, { showUI, onFrame }: FramesDeps): FramesApi {
  const { video } = ctx;
  let frameDuration = DEFAULT_FRAME;
  let frameSamples = 0;
  let lastFrame: VideoFrameCallbackMetadata | null = null;
  let frameCallbackId = 0;
  const supportsFrameCallback = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;

  function onVideoFrame(_now: DOMHighResTimeStamp, meta: VideoFrameCallbackMetadata): void {
    // Only consecutive frames at 1x give a reliable frame duration.
    if (lastFrame && meta.presentedFrames - lastFrame.presentedFrames === 1 && video.playbackRate === 1) {
      const dt = meta.mediaTime - lastFrame.mediaTime;
      if (dt > 1 / 121 && dt < 1 / 9) {
        frameDuration = frameSamples === 0 ? dt : frameDuration * 0.9 + dt * 0.1;
        frameSamples += 1;
      }
    }
    lastFrame = meta;
    onFrame(meta.mediaTime);
    frameCallbackId = video.requestVideoFrameCallback(onVideoFrame);
  }

  video.addEventListener('play', () => {
    if (!supportsFrameCallback) return;
    video.cancelVideoFrameCallback(frameCallbackId);
    lastFrame = null;
    frameCallbackId = video.requestVideoFrameCallback(onVideoFrame);
  });

  ctx.onSourceChange(() => {
    frameDuration = DEFAULT_FRAME;
    frameSamples = 0;
  });

  function stepFrame(direction: number): void {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    video.pause();
    video.currentTime = clamp(video.currentTime + direction * frameDuration, 0, video.duration);
    showUI();
  }

  return {
    stepFrame,
    getFrameRate: () => (frameSamples >= MIN_SAMPLES ? 1 / frameDuration : null),
  };
}
