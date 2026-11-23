// Shared state passed to every player module.

export type SourceKind = 'Local file' | 'Web link' | 'Opened file';

/** The video currently loaded in the player. */
export interface VideoSource {
  url: string;
  name: string;
  /** Stable identifier used to remember the playback position. */
  key: string;
  type: string;
  size?: number;
  /** File date in ms (local files) or Last-Modified (web links), when known. */
  modified?: number;
  kind: SourceKind;
  ext: string;
}

export interface PlayerContext {
  app: HTMLElement;
  /** The element that goes fullscreen. */
  player: HTMLElement;
  video: HTMLVideoElement;
  source: VideoSource | null;
  /** CSS filter currently applied to the video (used by screenshots). */
  imageFilter: string;
  onSourceChange: (listener: (source: VideoSource) => void) => void;
  emitSourceChange: (source: VideoSource) => void;
  // Cross-module hooks, set by the module that owns the feature.
  isDrawing?: () => boolean;
  wasPanning?: () => boolean;
  isQuarterTurn?: () => boolean;
  redrawAnnotations?: () => void;
  drawAnnotations?: (target: CanvasRenderingContext2D, width: number, height: number) => void;
}

export function createContext(app: HTMLElement, player: HTMLElement, video: HTMLVideoElement): PlayerContext {
  const listeners: ((source: VideoSource) => void)[] = [];
  return {
    app,
    player,
    video,
    source: null,
    imageFilter: 'none',
    onSourceChange(listener) {
      listeners.push(listener);
    },
    emitSourceChange(source) {
      for (const listener of listeners) listener(source);
    },
  };
}
