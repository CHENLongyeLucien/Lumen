// Applies the saved theme and accent before the page paints (no flash).
// Classic (non-module) script, loaded in <head> by every Lumen page.
(function applyAppearance() {
  var root = document.documentElement;
  var saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('lumen.appearance') || '{}') || {};
  } catch (e) {
    saved = {};
  }
  var theme = saved.theme || 'dark';
  if (theme === 'system') {
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  root.dataset.theme = theme;
  root.dataset.accent = saved.accent || 'amber';
})();
