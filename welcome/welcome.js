// Welcome / help page: explains how to enable "Allow access to file URLs".

const status = document.getElementById('status');
const btnSettings = document.getElementById('btnSettings');
const btnRetry = document.getElementById('btnRetry');
const btnPlayer = document.getElementById('btnPlayer');

const src = new URLSearchParams(location.search).get('src');
const playerUrl = chrome.runtime.getURL('player/player.html');

async function refreshStatus() {
  let allowed = false;
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
  chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
});
btnRetry.addEventListener('click', () => {
  location.href = `${playerUrl}?src=${encodeURIComponent(src)}`;
});
btnPlayer.addEventListener('click', () => {
  location.href = playerUrl;
});

window.addEventListener('focus', refreshStatus);
document.addEventListener('visibilitychange', refreshStatus);
refreshStatus();
