// Lumen service worker: detects navigations to direct video files and
// redirects the tab to the Lumen player page.

const VIDEO_EXTENSIONS = /\.(mp4|m4v|webm|ogv|ogg|mov)$/i;
const HANDLED_PROTOCOLS = new Set(['file:', 'http:', 'https:']);
const EXTENSION_ORIGIN = chrome.runtime.getURL('');
const PLAYER_URL = chrome.runtime.getURL('player/player.html');
const WELCOME_URL = chrome.runtime.getURL('welcome/welcome.html');

// Cached "redirect enabled" option (toggled from the popup).
let redirectEnabled = true;
const settingsReady = chrome.storage.sync
  .get({ redirectEnabled: true })
  .then((values) => { redirectEnabled = values.redirectEnabled !== false; })
  .catch(() => {});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.redirectEnabled) {
    redirectEnabled = changes.redirectEnabled.newValue !== false;
  }
});

/** True when the URL points directly to a video file we can handle. */
function isVideoUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  // URL.pathname already excludes ?query and #hash.
  return HANDLED_PROTOCOLS.has(url.protocol) && VIDEO_EXTENSIONS.test(url.pathname);
}

async function hasFileAccess() {
  try {
    return await chrome.extension.isAllowedFileSchemeAccess();
  } catch {
    return false;
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(
  async (details) => {
    const { url, tabId, frameId } = details;
    if (frameId !== 0 || tabId < 0) return; // main frame of a real tab only
    if (details.documentLifecycle === 'prerender') return;
    if (url.startsWith(EXTENSION_ORIGIN)) return; // anti-loop
    if (!isVideoUrl(url)) return;

    await settingsReady;
    if (!redirectEnabled) return;

    let target = `${PLAYER_URL}?src=${encodeURIComponent(url)}`;
    if (url.startsWith('file:') && !(await hasFileAccess())) {
      target = `${WELCOME_URL}?src=${encodeURIComponent(url)}`;
    }

    try {
      await chrome.tabs.update(tabId, { url: target });
    } catch (err) {
      console.warn('Lumen: redirect failed', err);
    }
  },
  { url: [{ schemes: ['file', 'http', 'https'] }] }
);

// On first install, explain how to enable local file access if needed.
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason !== chrome.runtime.OnInstalledReason.INSTALL) return;
  if (!(await hasFileAccess())) {
    chrome.tabs.create({ url: WELCOME_URL });
  }
});
