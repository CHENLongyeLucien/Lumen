// Pure formatting helpers (no DOM): time, sizes, dates, file names.

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Formats seconds as mm:ss, or h:mm:ss when needed (or forced). */
export function formatTime(seconds: number, forceHours = false): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  if (h > 0 || forceHours) return `${String(h)}:${String(m).padStart(2, '0')}:${s}`;
  return `${String(m).padStart(2, '0')}:${s}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i] ?? 'B'}`;
}

/** decodeURIComponent that returns the input unchanged on malformed escapes. */
export function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Decoded file name (last path segment) of a URL. */
export function fileNameFromUrl(rawUrl: string): string {
  try {
    const segment = new URL(rawUrl).pathname.split('/').filter(Boolean).pop() ?? '';
    return safeDecode(segment) || 'Video';
  } catch {
    return 'Video';
  }
}

/** Lower-case extension without the dot ("" when none). */
export function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match?.[1]?.toLowerCase() ?? '';
}

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

/** "3 days ago", "in 2 hours", "just now". */
export function relativeTime(ms: number, now: number = Date.now()): string {
  const diff = (ms - now) / 1000;
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= seconds) return relativeFormat.format(Math.round(diff / seconds), unit);
  }
  return 'just now';
}

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
export const formatDate = (ms: number): string => dateFormat.format(ms);

/** Common quality name from the picture's shorter side ("1080p", "4K"…). */
export function qualityLabel(width: number, height: number): string {
  const p = Math.min(width, height);
  if (p >= 2160) return '4K';
  if (p >= 1440) return '1440p';
  if (p >= 1080) return '1080p';
  if (p >= 720) return '720p';
  if (p >= 480) return '480p';
  return `${String(p)}p`;
}
