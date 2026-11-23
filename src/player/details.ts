// Details under the video: title, date, duration, quality, size and a
// collapsible description box. Also provides the rows of the info panel.

import type { PlayerContext, VideoSource } from './context';
import { $, extensionOf, formatBytes, formatTime } from './utils';

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

export type InfoRow = [label: string, value: string];

interface FileStat {
  size?: number;
  modified?: number;
}

function relativeTime(ms: number): string {
  const diff = (ms - Date.now()) / 1000;
  for (const [unit, seconds] of UNITS) {
    if (Math.abs(diff) >= seconds) return relativeFormat.format(Math.round(diff / seconds), unit);
  }
  return 'just now';
}

function qualityLabel(width: number, height: number): string {
  const p = Math.min(width, height);
  if (p >= 2160) return '4K';
  if (p >= 1440) return '1440p';
  if (p >= 1080) return '1080p';
  if (p >= 720) return '720p';
  if (p >= 480) return '480p';
  return `${String(p)}p`;
}

const safeDecode = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

/** GET a URL as text with XMLHttpRequest (works for file:// in extensions with file access). */
function xhrText(url: string, timeoutMs = 4000): Promise<string | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      resolve(xhr.responseText || null);
    };
    xhr.onerror = xhr.ontimeout = () => {
      resolve(null);
    };
    try {
      xhr.open('GET', url);
      xhr.send();
    } catch {
      resolve(null);
    }
  });
}

/**
 * Date and size of a local file, read from Chrome's directory listing page,
 * which contains lines like: addRow("name","url",isDir,size,"size",modifiedSeconds,"date").
 */
async function statLocalFile(fileUrl: string): Promise<FileStat | null> {
  const slash = fileUrl.lastIndexOf('/');
  const html = await xhrText(fileUrl.slice(0, slash + 1));
  if (!html) return null;
  const wanted = safeDecode(fileUrl.slice(slash + 1));
  const row = /addRow\(("(?:[^"\\]|\\.)*"),("(?:[^"\\]|\\.)*"),(\d+),(\d+),"(?:[^"\\]|\\.)*",(\d+),/g;
  for (const match of html.matchAll(row)) {
    try {
      const name: unknown = JSON.parse(match[1] ?? '""');
      const url: unknown = JSON.parse(match[2] ?? '""');
      if (name === wanted || (typeof url === 'string' && safeDecode(url) === wanted)) {
        return { size: Number(match[4]) || undefined, modified: Number(match[5]) * 1000 || undefined };
      }
    } catch {
      /* malformed row: skip */
    }
  }
  return null;
}

/** Last-Modified / Content-Length of a web video (only if the server allows it). */
async function statWebLink(url: string): Promise<FileStat | null> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const modified = Date.parse(response.headers.get('last-modified') ?? '');
    const size = Number(response.headers.get('content-length'));
    return { modified: Number.isFinite(modified) ? modified : undefined, size: size > 0 ? size : undefined };
  } catch {
    return null; // blocked by CORS or offline: the date is simply not shown
  }
}

function fetchStat(source: VideoSource): Promise<FileStat | null> {
  if (source.kind === 'Local file') return statLocalFile(source.url);
  if (source.kind === 'Web link') return statWebLink(source.url);
  return Promise.resolve(null);
}

const dateVerb = (source: VideoSource): string => (source.kind === 'Web link' ? 'Uploaded' : 'Saved');

function textSpan(text: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.textContent = text;
  return span;
}

/** Fills a <dl> with label/value rows. */
export function renderDefinitionList(list: HTMLElement, rows: readonly InfoRow[]): void {
  list.replaceChildren(
    ...rows.flatMap(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      return [dt, dd];
    }),
  );
}

export interface DetailsApi {
  infoRows(): InfoRow[];
}

export function initDetails(ctx: PlayerContext, { getFrameRate }: { getFrameRate: () => number | null }): DetailsApi {
  const { video } = ctx;
  const title = $('#videoTitle');
  const meta = $('#videoMeta');
  const description = $('#description');
  const list = $('#descList');
  const toggle = $('#descToggle');

  /** Label/value rows shared by the description box and the fullscreen info panel. */
  function infoRows(): InfoRow[] {
    const source = ctx.source;
    if (!source) return [];
    const fps = getFrameRate();
    const rows: InfoRow[] = [['Name', source.name]];
    if (source.modified) {
      rows.push([dateVerb(source), `${dateFormat.format(source.modified)} (${relativeTime(source.modified)})`]);
    }
    rows.push(
      ['Resolution', video.videoWidth ? `${String(video.videoWidth)} × ${String(video.videoHeight)}` : '—'],
      ['Duration', Number.isFinite(video.duration) ? formatTime(video.duration, video.duration >= 3600) : '—'],
      ['Type', source.type || '—'],
      ['Size', source.size ? formatBytes(source.size) : '—'],
      ['Frame rate', fps ? `≈ ${String(Math.round(fps))} fps` : 'measured while playing'],
      ['Source', source.kind],
    );
    if (!source.url.startsWith('blob:')) rows.push(['Location', safeDecode(source.url)]);
    return rows;
  }

  function render(): void {
    const source = ctx.source;
    if (!source) return;
    title.textContent = source.name.replace(/\.[^.]+$/, '') || source.name;

    const items: HTMLElement[] = [];
    if (source.modified) {
      const span = textSpan(`${dateVerb(source)} ${dateFormat.format(source.modified)}`);
      span.title = `${relativeTime(source.modified)} (file date)`;
      items.push(span);
    }
    if (Number.isFinite(video.duration)) items.push(textSpan(formatTime(video.duration, video.duration >= 3600)));
    if (video.videoWidth) items.push(textSpan(qualityLabel(video.videoWidth, video.videoHeight)));
    const ext = source.ext || extensionOf(source.name);
    if (ext) {
      const badge = textSpan(ext.toUpperCase());
      badge.className = 'badge';
      const span = document.createElement('span');
      span.append(badge);
      items.push(span);
    }
    if (source.size) items.push(textSpan(formatBytes(source.size)));
    meta.replaceChildren(...items);

    renderDefinitionList(list, infoRows().slice(1));
  }

  toggle.addEventListener('click', () => {
    const collapsed = description.classList.toggle('is-collapsed');
    toggle.textContent = collapsed ? 'Show more' : 'Show less';
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });

  async function loadStat(source: VideoSource): Promise<void> {
    const stat = await fetchStat(source);
    if (!stat || ctx.source !== source) return;
    if (stat.modified) source.modified = stat.modified;
    if (stat.size && !source.size) source.size = stat.size;
    render();
  }

  ctx.onSourceChange((source) => {
    render();
    void loadStat(source);
  });
  for (const type of ['loadedmetadata', 'durationchange', 'pause']) video.addEventListener(type, render);

  return { infoRows };
}
