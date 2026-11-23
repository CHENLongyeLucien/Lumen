// Popup: enable/disable the redirect, show local file access status.

const toggle = document.getElementById('toggleRedirect');
const fileStatus = document.getElementById('fileStatus');
const btnFix = document.getElementById('btnFix');
const btnOpenPlayer = document.getElementById('btnOpenPlayer');

const { redirectEnabled } = await chrome.storage.sync.get({ redirectEnabled: true });
toggle.checked = redirectEnabled !== false;
toggle.addEventListener('change', () => {
  chrome.storage.sync.set({ redirectEnabled: toggle.checked });
});

const allowed = await chrome.extension.isAllowedFileSchemeAccess();
fileStatus.textContent = allowed ? '✓ Local file access enabled' : '✕ Local file access disabled';
fileStatus.classList.add(allowed ? 'ok' : 'warn');
btnFix.hidden = allowed;

btnFix.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html') });
  window.close();
});

btnOpenPlayer.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('player/player.html') });
  window.close();
});
