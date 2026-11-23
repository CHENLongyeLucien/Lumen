// Lumen service worker: detects navigations to direct video files and
// redirects the tab to the Lumen player page.

import { readSetting } from './shared/storage';
import { isBoolean, PLAYER_PAGE, SYNC_DEFAULTS, WELCOME_PAGE } from './shared/types';
import { shouldRedirect, withSource } from './shared/video-url';

const EXTENSION_ORIGIN = chrome.runtime.getURL('');
const PLAYER_URL = chrome.runtime.getURL(PLAYER_PAGE);
const WELCOME_URL = chrome.runtime.getURL(WELCOME_PAGE);

// Cached "redirect enabled" option (toggled from the popup).
let redirectEnabled = SYNC_DEFAULTS.redirectEnabled;
const settingsReady = readSetting('sync', 'redirectEnabled', SYNC_DEFAULTS.redirectEnabled, isBoolean).then(
  (value) => {
    redirectEnabled = value;
  },
);

chrome.storage.onChanged.addListener((changes, area) => {
  const change = changes.redirectEnabled;
  if (area === 'sync' && change) {
    redirectEnabled = change.newValue !== false;
  }
});

async function hasFileAccess(): Promise<boolean> {
  try {
    return await chrome.extension.isAllowedFileSchemeAccess();
  } catch {
    return false;
  }
}

async function handleNavigation(details: chrome.webNavigation.WebNavigationBaseCallbackDetails): Promise<void> {
  if (!shouldRedirect(details, EXTENSION_ORIGIN)) return;

  await settingsReady;
  if (!redirectEnabled) return;

  const { url, tabId } = details;
  const needsHelpPage = url.startsWith('file:') && !(await hasFileAccess());
  const target = withSource(needsHelpPage ? WELCOME_URL : PLAYER_URL, url);

  try {
    await chrome.tabs.update(tabId, { url: target });
  } catch (err) {
    console.warn('Lumen: redirect failed', err);
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    void handleNavigation(details);
  },
  { url: [{ schemes: ['file', 'http', 'https'] }] },
);

// On first install, explain how to enable local file access if needed.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason !== chrome.runtime.OnInstalledReason.INSTALL) return;
  void hasFileAccess().then((allowed) => {
    if (!allowed) void chrome.tabs.create({ url: WELCOME_URL });
  });
});
