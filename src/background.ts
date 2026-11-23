// Lumen service worker: detects navigations to direct video files and
// redirects the tab to the Lumen player page.

import { readSetting } from './shared/storage';
import { isBoolean, PLAYER_PAGE, SOURCE_PARAM, SYNC_DEFAULTS, WELCOME_PAGE } from './shared/types';

const VIDEO_EXTENSIONS = /\.(mp4|m4v|webm|ogv|ogg|mov)$/i;
const HANDLED_PROTOCOLS = new Set(['file:', 'http:', 'https:']);
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

/** True when the URL points directly to a video file we can handle. */
function isVideoUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  // URL.pathname already excludes ?query and #hash.
  return HANDLED_PROTOCOLS.has(url.protocol) && VIDEO_EXTENSIONS.test(url.pathname);
}

async function hasFileAccess(): Promise<boolean> {
  try {
    return await chrome.extension.isAllowedFileSchemeAccess();
  } catch {
    return false;
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(
  (details) => {
    void handleNavigation(details);
  },
  { url: [{ schemes: ['file', 'http', 'https'] }] },
);

async function handleNavigation(details: chrome.webNavigation.WebNavigationBaseCallbackDetails): Promise<void> {
  const { url, tabId, frameId } = details;
  if (frameId !== 0 || tabId < 0) return; // main frame of a real tab only
  if (details.documentLifecycle === 'prerender') return;
  if (url.startsWith(EXTENSION_ORIGIN)) return; // anti-loop
  if (!isVideoUrl(url)) return;

  await settingsReady;
  if (!redirectEnabled) return;

  let target = `${PLAYER_URL}?${SOURCE_PARAM}=${encodeURIComponent(url)}`;
  if (url.startsWith('file:') && !(await hasFileAccess())) {
    target = `${WELCOME_URL}?${SOURCE_PARAM}=${encodeURIComponent(url)}`;
  }

  try {
    await chrome.tabs.update(tabId, { url: target });
  } catch (err) {
    console.warn('Lumen: redirect failed', err);
  }
}

// On first install, explain how to enable local file access if needed.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason !== chrome.runtime.OnInstalledReason.INSTALL) return;
  void hasFileAccess().then((allowed) => {
    if (!allowed) void chrome.tabs.create({ url: WELCOME_URL });
  });
});
