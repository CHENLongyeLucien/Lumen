// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initShortcuts, type ShortcutActions } from '../src/player/shortcuts';
import { createContext } from '../src/player/context';

const api = {
  hasSource: vi.fn(() => true),
  escape: vi.fn(() => true),
  togglePlay: vi.fn(),
  seekBy: vi.fn(),
  seekToFraction: vi.fn(),
  changeVolume: vi.fn(),
  toggleMute: vi.fn(),
  toggleFullscreen: vi.fn(),
  togglePip: vi.fn(),
  toggleTheater: vi.fn(),
  toggleDraw: vi.fn(),
  toggleSubtitles: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  stepSpeed: vi.fn(),
  stepFrame: vi.fn(),
} satisfies ShortcutActions;

/** Dispatches a keydown on `target` and returns whether the page's default action was prevented. */
function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): boolean {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeAll(() => {
  initShortcuts(api);
});
beforeEach(() => {
  vi.clearAllMocks();
  api.hasSource.mockReturnValue(true);
});

describe('README shortcut table', () => {
  it.each([
    [' ', 'togglePlay', [{ flash: true }]],
    ['k', 'togglePlay', [{ flash: true }]],
    ['ArrowLeft', 'seekBy', [-5]],
    ['ArrowRight', 'seekBy', [5]],
    ['j', 'seekBy', [-10]],
    ['l', 'seekBy', [10]],
    ['ArrowUp', 'changeVolume', [0.05]],
    ['ArrowDown', 'changeVolume', [-0.05]],
    ['m', 'toggleMute', [{ announce: true }]],
    ['f', 'toggleFullscreen', []],
    ['p', 'togglePip', []],
    ['<', 'stepSpeed', [-1]],
    ['>', 'stepSpeed', [1]],
    [',', 'stepFrame', [-1]],
    ['.', 'stepFrame', [1]],
    ['t', 'toggleTheater', []],
    ['d', 'toggleDraw', []],
    ['c', 'toggleSubtitles', []],
    ['+', 'zoomIn', []],
    ['=', 'zoomIn', []],
    ['-', 'zoomOut', []],
  ] as const)('%j calls %s', (key, action, args) => {
    expect(press(key)).toBe(true);
    expect(api[action]).toHaveBeenCalledWith(...args);
  });

  it('accepts upper-case letters (Shift or Caps Lock)', () => {
    press('K', { shiftKey: true });
    expect(api.togglePlay).toHaveBeenCalledOnce();
  });

  it('jumps to 0%…90% with the digit keys', () => {
    press('0', { code: 'Digit0' });
    press('7', { code: 'Numpad7' });
    expect(api.seekToFraction).toHaveBeenNthCalledWith(1, 0);
    expect(api.seekToFraction).toHaveBeenNthCalledWith(2, 0.7);
  });

  it('uses the physical digit key on AZERTY keyboards (no Shift needed)', () => {
    press('&', { code: 'Digit1' });
    expect(api.seekToFraction).toHaveBeenCalledWith(0.1);
  });

  it('treats the numeric keypad with Num Lock off as arrows', () => {
    press('ArrowLeft', { code: 'Numpad4' });
    expect(api.seekToFraction).not.toHaveBeenCalled();
    expect(api.seekBy).toHaveBeenCalledWith(-5);
  });

  it('Esc delegates to the escape chain', () => {
    expect(press('Escape')).toBe(true);
    expect(api.escape).toHaveBeenCalledOnce();
  });
});

describe('guards', () => {
  it('does not repeat toggles while a key is held', () => {
    press('k', { repeat: true });
    press('f', { repeat: true });
    expect(api.togglePlay).not.toHaveBeenCalled();
    expect(api.toggleFullscreen).not.toHaveBeenCalled();
    press('ArrowRight', { repeat: true }); // seeking may repeat
    expect(api.seekBy).toHaveBeenCalledOnce();
  });

  it('ignores keys with Ctrl, Alt or Meta (browser shortcuts)', () => {
    expect(press('f', { ctrlKey: true })).toBe(false);
    press('k', { altKey: true });
    press('l', { metaKey: true });
    expect(api.toggleFullscreen).not.toHaveBeenCalled();
    expect(api.togglePlay).not.toHaveBeenCalled();
    expect(api.seekBy).not.toHaveBeenCalled();
  });

  it('ignores keys typed in text fields, but Esc leaves the field', () => {
    const input = document.createElement('input');
    input.type = 'number';
    document.body.append(input);
    input.focus();
    expect(press('k', {}, input)).toBe(false);
    expect(api.togglePlay).not.toHaveBeenCalled();
    press('Escape', {}, input);
    expect(document.activeElement).not.toBe(input);
    expect(api.escape).not.toHaveBeenCalled();
    input.remove();
  });

  it('still works when a slider has focus', () => {
    const slider = document.createElement('input');
    slider.type = 'range';
    document.body.append(slider);
    expect(press('m', {}, slider)).toBe(true);
    expect(api.toggleMute).toHaveBeenCalledOnce();
    slider.remove();
  });

  it('does nothing but Esc when no video is open', () => {
    api.hasSource.mockReturnValue(false);
    expect(press('k')).toBe(false);
    expect(api.togglePlay).not.toHaveBeenCalled();
    expect(press('Escape')).toBe(true);
  });

  it('lets unknown keys through', () => {
    expect(press('q')).toBe(false);
  });
});

describe('player context', () => {
  it('notifies every source-change listener', () => {
    const ctx = createContext(document.body, document.body, document.createElement('video'));
    const first = vi.fn();
    const second = vi.fn();
    ctx.onSourceChange(first);
    ctx.onSourceChange(second);
    const source = {
      url: 'blob:x',
      name: 'a.mp4',
      key: 'k',
      type: 'video/mp4',
      kind: 'Opened file',
      ext: 'mp4',
    } as const;
    ctx.emitSourceChange(source);
    expect(first).toHaveBeenCalledWith(source);
    expect(second).toHaveBeenCalledWith(source);
  });
});
