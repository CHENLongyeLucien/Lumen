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

/** Buttons and inputs a user can reach inside a popover, in DOM order. */
function focusableItems(menu: HTMLElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>('button, input')].filter(
    (el) => !(el instanceof HTMLButtonElement && el.disabled) && el.offsetParent !== null,
  );
}

/** Arrow keys / Home / End move focus between a popover's buttons (sliders keep their own arrows). */
function handleMenuKeys(menu: HTMLElement, event: KeyboardEvent): void {
  if (!(event.target instanceof HTMLButtonElement)) return;
  const items = focusableItems(menu);
  const index = items.indexOf(event.target);
  const moves: Partial<Record<string, number>> = {
    ArrowDown: index + 1,
    ArrowRight: index + 1,
    ArrowUp: index - 1,
    ArrowLeft: index - 1,
    Home: 0,
    End: items.length - 1,
  };
  const next = moves[event.key];
  if (next === undefined || !items.length) return;
  event.preventDefault();
  event.stopPropagation(); // keep the player's arrow shortcuts (seek, volume) out of the menu
  items[(next + items.length) % items.length]?.focus();
}

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
      // Give focus back to the trigger when it was inside the popover (Esc, item chosen).
      const hadFocus = menu.contains(document.activeElement);
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      openMenus.delete(api);
      if (hadFocus) button.focus({ preventScroll: true });
      notifyMenuChange();
    },
    toggle() {
      if (api.isOpen()) api.close();
      else api.open();
    },
  };
  button.addEventListener('click', (event) => {
    api.toggle();
    // Opened from the keyboard (Enter/Space give detail 0): move focus into the popover.
    if (api.isOpen() && event.detail === 0 && !menu.contains(document.activeElement)) {
      focusableItems(menu)[0]?.focus({ preventScroll: true });
    }
  });
  menu.addEventListener('keydown', (event) => {
    handleMenuKeys(menu, event);
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
