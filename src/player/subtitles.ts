// External subtitles: loads .srt (converted to WebVTT) or .vtt files.

import type { PlayerContext } from './context';
import { $, closestTarget, extensionOf, setupMenu, showToast } from './utils';

/** Decodes subtitle bytes: UTF-16 (BOM), UTF-8, else Windows-1252 (common for old .srt). */
function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

const normalizeNewlines = (text: string): string => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

/** Converts SubRip (.srt) text to WebVTT. */
export function srtToVtt(srt: string): string {
  const timestamp = /(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})/g;
  const body = normalizeNewlines(srt)
    .trim()
    .split('\n')
    .map((line) => {
      if (!line.includes('-->')) return line.replace(/\{\\[^}]*\}/g, ''); // drop {\an8}-style tags
      return line.replace(
        timestamp,
        (_match, h: string, m: string, s: string, ms: string) =>
          `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.${ms.padEnd(3, '0')}`,
      );
    })
    .join('\n');
  return `WEBVTT\n\n${body}\n`;
}

function normalizeVtt(text: string): string {
  const clean = normalizeNewlines(text);
  return clean.startsWith('WEBVTT') ? clean : `WEBVTT\n\n${clean}`;
}

export interface SubtitlesApi {
  loadFile(file: File): Promise<void>;
  pickFile(): void;
  toggle(): boolean;
}

export function initSubtitles(ctx: PlayerContext): SubtitlesApi {
  const { video } = ctx;
  const button = $<HTMLButtonElement>('#btnSubtitles');
  const input = $<HTMLInputElement>('#subtitleInput');
  const menu = $('#subtitlesMenu');
  const toggleItem = $<HTMLButtonElement>('[data-sub="toggle"]', menu);
  const trackName = $('#subTrackName');
  const chip = $('#actSubtitles');
  let trackEl: HTMLTrackElement | null = null;
  let trackUrl: string | null = null;

  function render(): void {
    const showing = trackEl?.track.mode === 'showing';
    button.classList.toggle('is-active', showing);
    chip.classList.toggle('is-active', showing);
    toggleItem.disabled = !trackEl;
    toggleItem.setAttribute('aria-checked', String(showing));
    trackName.textContent = trackEl ? trackEl.label : 'None';
  }

  function removeTrack(): void {
    trackEl?.remove();
    trackEl = null;
    if (trackUrl) URL.revokeObjectURL(trackUrl);
    trackUrl = null;
    render();
  }

  async function loadFile(file: File): Promise<void> {
    try {
      const text = decodeText(await file.arrayBuffer());
      const vtt = extensionOf(file.name) === 'srt' ? srtToVtt(text) : normalizeVtt(text);
      removeTrack();

      trackUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
      const el = document.createElement('track');
      el.kind = 'subtitles';
      el.label = file.name;
      el.srclang = 'und';
      el.src = trackUrl;
      el.default = true;
      el.addEventListener('load', () => {
        if (!el.track.cues?.length) showToast(`No subtitles found in "${file.name}"`);
      });
      el.addEventListener('error', () => {
        showToast(`Could not read subtitles from "${file.name}"`);
        if (trackEl === el) removeTrack();
      });
      video.append(el);
      el.track.mode = 'showing';
      trackEl = el;
      render();
      showToast(`Subtitles: ${file.name}`);
    } catch (err) {
      console.error('Lumen: subtitles failed', err);
      showToast('Could not load these subtitles');
    }
  }

  const pickFile = (): void => {
    input.click();
  };

  /** Shows/hides the loaded track. Returns false when there is nothing to toggle. */
  function toggle(): boolean {
    if (!trackEl) {
      showToast('No subtitles loaded: open the subtitles menu (CC) to add some');
      return false;
    }
    trackEl.track.mode = trackEl.track.mode === 'showing' ? 'hidden' : 'showing';
    render();
    showToast(trackEl.track.mode === 'showing' ? 'Subtitles on' : 'Subtitles off');
    return true;
  }

  /** Automatic captions: Chrome's built-in Live Caption works on any video, offline. */
  function openAutomaticCaptions(): void {
    showToast('Turn on "Live Caption" in Chrome settings: captions then appear automatically for any video', 6000);
    try {
      void chrome.tabs.create({ url: 'chrome://settings/accessibility' });
    } catch {
      /* page opened outside the extension */
    }
  }

  const menuApi = setupMenu(button, menu);
  menu.addEventListener('click', (event) => {
    const action = closestTarget(event.target, '[data-sub]')?.dataset.sub;
    if (!action) return;
    menuApi.close();
    if (action === 'toggle') toggle();
    else if (action === 'load') pickFile();
    else if (action === 'auto') openAutomaticCaptions();
  });
  chip.addEventListener('click', () => {
    if (trackEl) toggle();
    else pickFile();
  });
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) void loadFile(file);
    input.value = '';
  });
  // Subtitles belong to one video: drop them when the source changes.
  ctx.onSourceChange(removeTrack);
  render();

  return { loadFile, pickFile, toggle };
}
