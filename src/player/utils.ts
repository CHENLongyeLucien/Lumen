// Small shared helpers: DOM, time formatting, toast, popover menus.

/** querySelector that fails loudly: every selector used by the player exists in player.html. */
export function $<T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Lumen: missing element ${selector}`);
  return el;
}

/** Closest ancestor (or self) of an event target matching `selector`. */
export function closestTarget<T extends HTMLElement = HTMLElement>(
  target: EventTarget | null,
  selector: string,
): T | null {
  return target instanceof Element ? target.closest<T>(selector) : null;
}

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Formats seconds as mm:ss, or h:mm:ss when needed (or forced). */
export function formatTime(seconds: number, forceHours = false): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  if (h > 0 || forceHours) return `${h}:${String(m).padStart(2, '0')}:${s}`;
  return `${String(m).padStart(2, '0')}:${s}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i] ?? 'B'}`;
}

/** Decoded file name (last path segment) of a URL. */
export function fileNameFromUrl(rawUrl: string): string {
  try {
    const segment = new URL(rawUrl).pathname.split('/').filter(Boolean).pop() ?? '';
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
export function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match?.[1]?.toLowerCase() ?? '';
}

/* ---------- Toast ---------- */

let toastTimer = 0;
export function showToast(message: string, duration = 1800): void {
  const el = document.querySelector<HTMLElement>('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('is-visible'), duration);
}

/* ---------- Popover menus ---------- */

export interface MenuApi {
  isOpen(): boolean;
  contains(node: Node): boolean;
  open(): void;
  close(): void;
  toggle(): void;
}

const openMenus = new Set<MenuApi>();
const menuListeners = new Set<() => void>();
let lastOutsideCloseAt = 0;

const notifyMenuChange = (): void => {
  menuListeners.forEach((fn) => {
    fn();
  });
};

export const onMenuChange = (fn: () => void): void => {
  menuListeners.add(fn);
};
export const anyMenuOpen = (): boolean => openMenus.size > 0;
/** True right after a menu was closed by clicking outside it (so that click is "consumed"). */
export const wasMenuJustClosed = (): boolean => performance.now() - lastOutsideCloseAt < 400;

export function setupMenu(button: HTMLElement, menu: HTMLElement, options: { onOpen?: () => void } = {}): MenuApi {
  const api: MenuApi = {
    isOpen: () => !menu.hidden,
    contains: (node) => menu.contains(node) || button.contains(node),
    open() {
      closeAllMenus();
      menu.hidden = false;
      // Menus inside the player must fit between their button and the player's top edge.
      const bounds = menu.closest('.player');
      if (bounds) {
        const room = button.getBoundingClientRect().top - bounds.getBoundingClientRect().top - 16;
        menu.style.maxHeight = `${String(Math.max(120, room))}px`;
      }
      button.setAttribute('aria-expanded', 'true');
      openMenus.add(api);
      options.onOpen?.();
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
  button.addEventListener('click', () => {
    api.toggle();
  });
  return api;
}

export function closeAllMenus(): boolean {
  if (!openMenus.size) return false;
  [...openMenus].forEach((menu) => {
    menu.close();
  });
  return true;
}

// Clicking anywhere outside an open menu closes it.
document.addEventListener(
  'pointerdown',
  (event) => {
    const target = event.target;
    for (const menu of [...openMenus]) {
      if (!(target instanceof Node) || !menu.contains(target)) {
        menu.close();
        lastOutsideCloseAt = performance.now();
      }
    }
  },
  true,
);
