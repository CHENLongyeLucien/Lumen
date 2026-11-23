// Download a web video with Chrome's downloader (chrome.downloads), so it uses
// the browser's own cookies and sign-ins. Useful when a posted link refuses to
// play inside Lumen. Once saved, the video can be played from the local file.

import type { PlayerContext, VideoSource } from './context';
import { downloadFileName, downloadProgress, pathToFileUrl } from './download-name';
import { closeAllMenus, showToast } from './utils';
import { PLAYER_PAGE, SOURCE_PARAM } from '../shared/types';

type DownloadStatus = 'idle' | 'downloading' | 'complete' | 'failed';

interface DownloadState {
  status: DownloadStatus;
  id?: number;
  path?: string;
  detail?: string;
}

const POLL_MS = 500;

/** chrome.downloads, or null outside the extension / without the permission. */
function downloadsApi(): typeof chrome.downloads | null {
  const api = (globalThis as { chrome?: { downloads?: typeof chrome.downloads } }).chrome;
  return api?.downloads ?? null;
}

export interface DownloadApi {
  start: () => void;
}

export function initDownload(ctx: PlayerContext): DownloadApi {
  const triggers = [...document.querySelectorAll<HTMLButtonElement>('[data-download]')];
  const statusLine = document.querySelector<HTMLElement>('#downloadStatus');
  const btnPlay = document.querySelector<HTMLButtonElement>('#btnPlayDownloaded');
  const btnShow = document.querySelector<HTMLButtonElement>('#btnShowDownload');

  let state: DownloadState = { status: 'idle' };
  let pollTimer = 0;
  // The download belongs to the source it was started for.
  let downloadSource: VideoSource | null = null;

  const isWebLink = (): boolean => ctx.source?.kind === 'Web link';

  function render(): void {
    const visible = isWebLink();
    for (const btn of triggers) {
      btn.hidden = !visible;
      btn.disabled = state.status === 'downloading';
    }
    if (statusLine) {
      const text: Record<DownloadStatus, string> = {
        idle: '',
        downloading: `Downloading… ${state.detail ?? ''}`.trim(),
        complete: 'Saved to your Downloads folder.',
        failed: `Download failed${state.detail ? ` (${state.detail})` : ''}.`,
      };
      statusLine.textContent = text[state.status];
      statusLine.hidden = !visible || state.status === 'idle';
    }
    const done = visible && state.status === 'complete';
    if (btnPlay) btnPlay.hidden = !done;
    if (btnShow) btnShow.hidden = !done;
  }

  function setState(next: DownloadState): void {
    state = next;
    render();
  }

  function stopPolling(): void {
    window.clearInterval(pollTimer);
    pollTimer = 0;
  }

  async function refreshProgress(api: typeof chrome.downloads, id: number): Promise<void> {
    const [item] = await api.search({ id });
    if (!item || state.id !== id || state.status !== 'downloading') return;
    setState({ ...state, detail: downloadProgress(item.bytesReceived, item.totalBytes) });
  }

  async function finish(api: typeof chrome.downloads, id: number): Promise<void> {
    stopPolling();
    const [item] = await api.search({ id });
    setState({ status: 'complete', id, path: item?.filename });
    showToast(`Downloaded: ${item?.filename.split(/[\\/]/).pop() ?? 'video'}`, 3500);
  }

  async function start(): Promise<void> {
    closeAllMenus();
    const source = ctx.source;
    if (source?.kind !== 'Web link' || state.status === 'downloading') return;
    const api = downloadsApi();
    if (!api) {
      showToast('Downloading is only available in the installed extension');
      return;
    }
    downloadSource = source;
    setState({ status: 'downloading', detail: '' });
    try {
      const filename = downloadFileName(source.url);
      const id = await api.download({ url: source.url, ...(filename ? { filename } : {}) });
      setState({ status: 'downloading', id, detail: '' });
      showToast('Download started');
      pollTimer = window.setInterval(() => {
        void refreshProgress(api, id);
      }, POLL_MS);
    } catch (err) {
      console.warn('Lumen: download failed', err);
      setState({ status: 'failed', detail: err instanceof Error ? err.message : undefined });
    }
  }

  // Completion / failure notifications from Chrome's downloader.
  downloadsApi()?.onChanged.addListener((delta) => {
    const api = downloadsApi();
    if (!api || delta.id !== state.id) return;
    if (delta.state?.current === 'complete') void finish(api, delta.id);
    if (delta.state?.current === 'interrupted') {
      stopPolling();
      const reason = delta.error?.current;
      setState({
        status: 'failed',
        id: delta.id,
        detail: reason ? reason.toLowerCase().replace(/_/g, ' ') : undefined,
      });
    }
  });

  for (const btn of triggers) {
    btn.addEventListener('click', () => {
      void start();
    });
  }
  btnPlay?.addEventListener('click', () => {
    if (!state.path) return;
    const playerUrl = chrome.runtime.getURL(PLAYER_PAGE);
    location.href = `${playerUrl}?${SOURCE_PARAM}=${encodeURIComponent(pathToFileUrl(state.path))}`;
  });
  btnShow?.addEventListener('click', () => {
    if (state.id !== undefined) downloadsApi()?.show(state.id);
  });

  ctx.onSourceChange((source) => {
    // A new video: forget a finished/failed download of another one (a running one keeps going).
    if (source !== downloadSource && state.status !== 'downloading') setState({ status: 'idle' });
    else render();
  });
  render();

  return {
    start: () => {
      void start();
    },
  };
}
