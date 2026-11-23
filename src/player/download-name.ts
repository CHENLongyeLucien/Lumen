// Pure helpers for downloading a web video: the file name to suggest and the
// file:// URL of the saved file.

import { fileNameFromUrl } from './format';

const MAX_NAME_LENGTH = 180;
// Characters Windows, macOS or Chrome's downloads API refuse in a file name.
const FORBIDDEN = /[\\/:*?"<>|\p{Cc}]/gu;

/**
 * A safe file name for chrome.downloads, derived from the video URL, or
 * undefined to let Chrome choose (e.g. when the URL has no usable name).
 */
export function downloadFileName(url: string): string | undefined {
  const raw = fileNameFromUrl(url);
  if (raw === 'Video') return undefined; // fileNameFromUrl's fallback: no real name in the URL
  const cleaned = raw
    .replace(FORBIDDEN, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '') // no leading/trailing dots or spaces
    .slice(-MAX_NAME_LENGTH);
  return /[^_]/.test(cleaned) ? cleaned : undefined;
}

/** Converts an absolute path from chrome.downloads (Windows or POSIX) to a file:// URL. */
export function pathToFileUrl(path: string): string {
  const slashed = path.replace(/\\/g, '/');
  const rooted = slashed.startsWith('/') ? slashed : `/${slashed}`;
  const encoded = rooted
    .split('/')
    .map((segment, index) =>
      index === 1 && /^[a-z]:$/i.test(segment) ? segment : encodeURIComponent(segment),
    )
    .join('/');
  return `file://${encoded}`;
}

/** "42%" while the total is known, otherwise the bytes received so far. */
export function downloadProgress(received: number, total: number): string {
  if (total > 0) return `${String(Math.min(100, Math.floor((received / total) * 100)))}%`;
  if (received <= 0) return '';
  const mb = received / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}
