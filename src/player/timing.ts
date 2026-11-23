// Timer helpers (no DOM), testable with fake timers.

type TimerHandle = ReturnType<typeof setTimeout>;

/** Delays `fn` until `ms` have passed without another call. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let timer: TimerHandle | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, ms);
  };
}

export interface AutoHide {
  /** Shows the UI now and schedules hiding after the default delay. */
  show: () => void;
  /** Re-schedules hiding after `ms` (e.g. sooner when the pointer leaves). */
  scheduleHide: (ms: number) => void;
}

/**
 * Auto-hide controller: after `delay` ms of inactivity, calls `onHide` if
 * `canHide()` allows it (e.g. not while paused, scrubbing or with a menu open).
 */
export function createAutoHide(options: {
  delay: number;
  canHide: () => boolean;
  onShow: () => void;
  onHide: () => void;
}): AutoHide {
  let timer: TimerHandle | undefined;
  const tryHide = (): void => {
    if (options.canHide()) options.onHide();
  };
  const scheduleHide = (ms: number): void => {
    clearTimeout(timer);
    timer = setTimeout(tryHide, ms);
  };
  return {
    show() {
      options.onShow();
      scheduleHide(options.delay);
    },
    scheduleHide,
  };
}
