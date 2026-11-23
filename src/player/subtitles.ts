// External subtitles: loads .srt (converted to WebVTT) or .vtt files.

import type { PlayerContext } from './context';
import { decodeText, normalizeVtt, srtToVtt } from './subtitle-format';
import { $, $as, closestTarget, extensionOf, setupMenu, showToast } from './utils';

export interface SubtitlesApi {
  loadFile: (file: File) => Promise<void>;
  pickFile: () => void;
  toggle: () => boolean;
}

export function initSubtitles(ctx: PlayerContext): SubtitlesApi {
  const { video } = ctx;
  const button = $as('#btnSubtitles', HTMLButtonElement);
  const input = $as('#subtitleInput', HTMLInputElement);
  const menu = $('#subtitlesMenu');
  const toggleItem = $as('[data-sub="toggle"]', HTMLButtonElement, menu);
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
    showToast(
      'Turn on "Live Caption" in Chrome settings: captions then appear automatically for any video',
      6000,
    );
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
