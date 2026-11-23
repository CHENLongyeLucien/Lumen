// Popup: enable/disable the redirect, show local file access status.

import { readSetting, writeSetting } from '../shared/storage';
import { isBoolean, PLAYER_PAGE, SYNC_DEFAULTS, WELCOME_PAGE } from '../shared/types';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
}

const toggle = byId<HTMLInputElement>('toggleRedirect');
const fileStatus = byId('fileStatus');
const btnFix = byId<HTMLButtonElement>('btnFix');
const btnOpenPlayer = byId<HTMLButtonElement>('btnOpenPlayer');

toggle.checked = await readSetting('sync', 'redirectEnabled', SYNC_DEFAULTS.redirectEnabled, isBoolean);
toggle.addEventListener('change', () => {
  void writeSetting('sync', 'redirectEnabled', toggle.checked);
});

const allowed = await chrome.extension.isAllowedFileSchemeAccess();
fileStatus.textContent = allowed ? '✓ Local file access enabled' : '✕ Local file access disabled';
fileStatus.classList.add(allowed ? 'ok' : 'warn');
btnFix.hidden = allowed;

btnFix.addEventListener('click', () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL(WELCOME_PAGE) });
  window.close();
});

btnOpenPlayer.addEventListener('click', () => {
  void chrome.tabs.create({ url: chrome.runtime.getURL(PLAYER_PAGE) });
  window.close();
});
