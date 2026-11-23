import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutoHide, debounce } from '../src/player/timing';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('runs once, after the last call has settled', () => {
    const fn = vi.fn();
    const save = debounce(fn, 300);
    save(1);
    vi.advanceTimersByTime(200);
    save(2);
    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith(2);
  });
});

describe('createAutoHide', () => {
  const setup = (canHide = true) => {
    const state = { visible: true, canHide };
    const autoHide = createAutoHide({
      delay: 3000,
      canHide: () => state.canHide,
      onShow: () => {
        state.visible = true;
      },
      onHide: () => {
        state.visible = false;
      },
    });
    return { state, autoHide };
  };

  it('hides the UI 3 s after the last activity', () => {
    const { state, autoHide } = setup();
    autoHide.show();
    vi.advanceTimersByTime(2999);
    expect(state.visible).toBe(true);
    vi.advanceTimersByTime(1);
    expect(state.visible).toBe(false);
  });

  it('restarts the countdown on new activity and shows the UI again', () => {
    const { state, autoHide } = setup();
    autoHide.show();
    vi.advanceTimersByTime(3000);
    expect(state.visible).toBe(false);
    autoHide.show();
    expect(state.visible).toBe(true);
    vi.advanceTimersByTime(2000);
    autoHide.show();
    vi.advanceTimersByTime(2000);
    expect(state.visible).toBe(true);
  });

  it('stays visible while hiding is not allowed (paused, menu open…)', () => {
    const { state, autoHide } = setup(false);
    autoHide.show();
    vi.advanceTimersByTime(10_000);
    expect(state.visible).toBe(true);
  });

  it('can hide sooner, e.g. when the pointer leaves the player', () => {
    const { state, autoHide } = setup();
    autoHide.show();
    autoHide.scheduleHide(700);
    vi.advanceTimersByTime(700);
    expect(state.visible).toBe(false);
  });
});
