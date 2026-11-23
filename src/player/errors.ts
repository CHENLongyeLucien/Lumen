// Pure mapping from a media error to a category and a readable message.

import type { SourceKind } from './context';

/** HTMLMediaElement error codes (MediaError.MEDIA_ERR_*), duplicated so this module has no DOM dependency. */
export const MEDIA_ERR = { ABORTED: 1, NETWORK: 2, DECODE: 3, SRC_NOT_SUPPORTED: 4 } as const;

export type ErrorCategory = 'aborted' | 'network' | 'unreadable' | 'corrupted' | 'missing' | 'link' | 'unsupported';

export interface ErrorMessage {
  title: string;
  message: string;
}

export const CODEC_HINT =
  'Chrome plays MP4 (H.264/AAC) and WebM (VP8/VP9/AV1) everywhere; MKV, AVI and H.265 depend on your machine.';

const RISKY_FORMATS: Partial<Record<string, string>> = {
  mkv: 'MKV',
  avi: 'AVI',
  wmv: 'WMV',
  flv: 'FLV',
  mpg: 'MPEG',
  mpeg: 'MPEG',
  hevc: 'H.265',
  ts: 'MPEG-TS',
  m2ts: 'MPEG-TS',
  mts: 'MPEG-TS',
};

/** Only an unsupported-source error on a local file needs to check whether the file exists. */
export const needsExistenceCheck = (code: number, kind: SourceKind): boolean =>
  code === MEDIA_ERR.SRC_NOT_SUPPORTED && kind === 'Local file';

/**
 * Classifies a media error. `fileExists` is the result of the existence check
 * for local files (false = not found, true/null = exists or unknown).
 */
export function errorCategory(code: number, kind: SourceKind, fileExists: boolean | null = null): ErrorCategory {
  switch (code) {
    case MEDIA_ERR.ABORTED:
      return 'aborted';
    case MEDIA_ERR.NETWORK:
      return kind === 'Web link' ? 'network' : 'unreadable';
    case MEDIA_ERR.DECODE:
      return 'corrupted';
    default:
      if (kind === 'Local file' && fileExists === false) return 'missing';
      if (kind === 'Web link') return 'link';
      return 'unsupported';
  }
}

export function errorMessage(category: ErrorCategory, ext: string): ErrorMessage {
  switch (category) {
    case 'aborted':
      return {
        title: 'Loading was interrupted',
        message: 'The video stopped loading before it could play. Try opening it again.',
      };
    case 'network':
      return {
        title: 'Network error',
        message:
          'The connection failed while loading the video. Check your connection or the link, then reload the page.',
      };
    case 'unreadable':
      return {
        title: 'The file could not be read',
        message: 'It may have been moved or deleted, or it is on a drive that is no longer connected.',
      };
    case 'corrupted':
      return {
        title: 'This file seems corrupted',
        message:
          'Chrome started reading the video but could not decode it. The file may be damaged or incomplete (for example, an unfinished download).',
      };
    case 'missing':
      return {
        title: 'File not found or inaccessible',
        message:
          'Lumen could not read this file. Check that it still exists, and that "Allow access to file URLs" is enabled for Lumen in chrome://extensions.',
      };
    case 'link':
      return {
        title: "Can't play this link",
        message: `The link may be broken, require a login, refuse to be played from another page, or use a format Chrome can't decode. ${CODEC_HINT}`,
      };
    case 'unsupported': {
      const format = RISKY_FORMATS[ext];
      return {
        title: 'Unsupported format',
        message: `${format ? `${format} files often use codecs Chrome can't decode.` : 'Chrome cannot decode this video.'} ${CODEC_HINT}`,
      };
    }
  }
}
