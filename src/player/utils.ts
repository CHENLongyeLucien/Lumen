// Small shared helpers: DOM, time formatting, storage, toast, popover menus.

export const $ = (selector, root = document) => root.querySelector(selector);

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Formats seconds as mm:ss, or h:mm:ss when needed (or forced). */
export function formatTime(seconds, forceHours = false) {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  if (h > 0 || forceHours) return `${h}:${String(m).padStart(2, '0')}:${s}`;
  return `${String(m).padStart(2, '0')}:${s}`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Decoded file name (last path segment) of a URL. */
export function fileNameFromUrl(rawUrl) {
  try {
    const segment = new URL(rawUrl).pathname.split('/').filter(Boolean).pop() || '';
    try {
      return decodeURIComponent(segment) || 'Video';
    } catch {
      return segment || 'Video';
    }
  } catch {
    return 'Video';
  }
}

/** Lower-case extension without the dot ("" when none). */
export function extensionOf(name) {
  const match = /\.([a-z0-9]+)$/i.exec(name || '');
  return match ? match[1].toLowerCase() : '';
}

/* ---------- Storage (guarded so the page also runs outside the extension) ---------- */

const storageArea = (area) => globalThis.chrome?.storage?.[area] ?? null;

export async function loadSetting(key, fallback, area = 'local') {
  const store = storageArea(area);
  if (!store) return fallback;
  try {
    const result = await store.get({ [key]: fallback });
    return result[key];
  } catch {
    return fallback;
  }
}

export async function saveSetting(key, value, area = 'local') {
  const store = storageArea(area);
  if (!store) return;
  try {
    await store.set({ [key]: value });
  } catch (err) {
    console.warn('Lumen: could not save setting', key, err);
  }
}

/* ---------- Toast ---------- */

let toastTimer = 0;
export function showToast(message, duration = 1800) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), duration);
}

/* ---------- Popover menus ---------- */

const openMenus = new Set();
const menuListeners = new Set();
let lastOutsideCloseAt = 0;

const notifyMenuChange = () => menuListeners.forEach((fn) => fn());

export const onMenuChange = (fn) => menuListeners.add(fn);
export const anyMenuOpen = () => openMenus.size > 0;
/** True right after a menu was closed by clicking outside it (so that click is "consumed"). */
export const wasMenuJustClosed = () => performance.now() - lastOutsideCloseAt < 400;

export function setupMenu(button, menu, { onOpen } = {}) {
  const api = {
    isOpen: () => !menu.hidden,
    contains: (node) => menu.contains(node) || button.contains(node),
    open() {
      closeAllMenus();
      menu.hidden = false;
      // Menus inside the player must fit between their button and the player's top edge.
      const bounds = menu.closest('.player');
      if (bounds) {
        const room = button.getBoundingClientRect().top - bounds.getBoundingClientRect().top - 16;
        menu.style.maxHeight = `${Math.max(120, room)}px`;
      }
      button.setAttribute('aria-expanded', 'true');
      openMenus.add(api);
      onOpen?.();
      notifyMenuChange();
    },
    close() {
      if (menu.hidden) return;
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      openMenus.delete(api);
      notifyMenuChange();
    },
    toggle() {
      if (api.isOpen()) api.close();
      else api.open();
    },
  };
  button.addEventListener('click', () => api.toggle());
  return api;
}

export function closeAllMenus() {
  if (!openMenus.size) return false;
  [...openMenus].forEach((menu) => menu.close());
  return true;
}

// Clicking anywhere outside an open menu closes it.
document.addEventListener(
  'pointerdown',
  (event) => {
    for (const menu of [...openMenus]) {
      if (!menu.contains(event.target)) {
        menu.close();
        lastOutsideCloseAt = performance.now();
      }
    }
  },
  true
);
