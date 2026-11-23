// Welcome / help page: explains how to enable "Allow access to file URLs".

import { PLAYER_PAGE, SOURCE_PARAM } from '../shared/types';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const status = byId('status');
const btnSettings = byId<HTMLButtonElement>('btnSettings');
const btnRetry = byId<HTMLButtonElement>('btnRetry');
const btnPlayer = byId<HTMLButtonElement>('btnPlayer');

const src = new URLSearchParams(location.search).get(SOURCE_PARAM);
const playerUrl = chrome.runtime.getURL(PLAYER_PAGE);

async function refreshStatus(): Promise<void> {
  let allowed: boolean;
  try {
    allowed = await chrome.extension.isAllowedFileSchemeAccess();
  } catch {
    allowed = false;
  }
  status.textContent = allowed ? '✓ Local file access is enabled' : '✕ Local file access is disabled';
  status.className = `status ${allowed ? 'ok' : 'warn'}`;
  btnRetry.hidden = !(allowed && src);
}

btnSettings.addEventListener('click', () => {
  void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
});
btnRetry.addEventListener('click', () => {
  if (src) location.href = `${playerUrl}?${SOURCE_PARAM}=${encodeURIComponent(src)}`;
});
btnPlayer.addEventListener('click', () => {
  location.href = playerUrl;
});

const refresh = (): void => void refreshStatus();
window.addEventListener('focus', refresh);
document.addEventListener('visibilitychange', refresh);
refresh();
