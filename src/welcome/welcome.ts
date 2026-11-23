// Welcome / help page: explains how to enable "Allow access to file URLs".

import { PLAYER_PAGE, SOURCE_PARAM } from '../shared/types';

/** getElementById with a runtime type check. */
function byId<T extends HTMLElement>(id: string, type: abstract new (...args: never[]) => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof type)) throw new Error(`Missing or unexpected element #${id}`);
  return el;
}

const status = byId('status', HTMLElement);
const btnSettings = byId('btnSettings', HTMLButtonElement);
const btnRetry = byId('btnRetry', HTMLButtonElement);
const btnPlayer = byId('btnPlayer', HTMLButtonElement);

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
