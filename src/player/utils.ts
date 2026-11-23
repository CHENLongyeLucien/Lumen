// Small shared helpers: DOM, time formatting, toast, popover menus.

/** querySelector that fails loudly: every selector used by the player exists in player.html. */
export function $(selector: string, root: ParentNode = document): HTMLElement {
  return $as(selector, HTMLElement, root);
}

/** Like `$`, but also checks the element's type at runtime (e.g. HTMLInputElement). */
export function $as<T extends Element>(
  selector: string,
  type: abstract new (...args: never[]) => T,
  root: ParentNode = document,
): T {
  const el = root.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`Lumen: missing or unexpected element ${selector}`);
  return el;
}

/** Closest HTML ancestor (or self) of an event target matching `selector`. */
export function closestTarget(target: EventTarget | null, selector: string): HTMLElement | null {
  const match = target instanceof Element ? target.closest(selector) : null;
  return match instanceof HTMLElement ? match : null;
}

export { clamp, extensionOf, fileNameFromUrl, formatBytes, formatTime } from './format';

/* ---------- Toast ---------- */

let toastTimer = 0;
export function showToast(message: string, duration = 1800): void {
  const el = document.querySelector<HTMLElement>('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.classList.remove('is-visible');
  }, duration);
}

/* ---------- Popover menus ---------- */

export interface MenuApi {
  isOpen: () => boolean;
  contains: (node: Node) => boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
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

export function setupMenu(
  button: HTMLElement,
  menu: HTMLElement,
  options: { onOpen?: () => void } = {},
): MenuApi {
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
