import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSetting, writeSetting } from '../src/shared/storage';
import { isBoolean, isSavedPositions, isVolumeSetting } from '../src/shared/types';

/** Installs a fake chrome.storage area backed by a plain object. */
function mockChromeStorage(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial };
  const area = {
    get: vi.fn((key: string) => Promise.resolve(key in data ? { [key]: data[key] } : {})),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(data, items);
      return Promise.resolve();
    }),
  };
  vi.stubGlobal('chrome', { storage: { local: area, sync: area } });
  return { data, area };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('readSetting', () => {
  it('returns the stored value when it passes the guard', async () => {
    mockChromeStorage({ volume: { level: 0.4, muted: true } });
    await expect(
      readSetting('local', 'volume', { level: 1, muted: false }, isVolumeSetting),
    ).resolves.toEqual({
      level: 0.4,
      muted: true,
    });
  });

  it('returns the fallback when the key is missing', async () => {
    mockChromeStorage();
    await expect(readSetting('sync', 'redirectEnabled', true, isBoolean)).resolves.toBe(true);
  });

  it('returns the fallback when the stored value is invalid', async () => {
    mockChromeStorage({ volume: { level: 'loud' }, positions: { a: { time: 'x' } } });
    await expect(
      readSetting('local', 'volume', { level: 1, muted: false }, isVolumeSetting),
    ).resolves.toEqual({
      level: 1,
      muted: false,
    });
    await expect(readSetting('local', 'positions', {}, isSavedPositions)).resolves.toEqual({});
  });

  it('returns the fallback when storage throws', async () => {
    const { area } = mockChromeStorage();
    area.get.mockRejectedValueOnce(new Error('quota'));
    await expect(readSetting('sync', 'redirectEnabled', false, isBoolean)).resolves.toBe(false);
  });

  it('returns the fallback outside the extension (no chrome global)', async () => {
    vi.stubGlobal('chrome', undefined);
    await expect(readSetting('sync', 'redirectEnabled', true, isBoolean)).resolves.toBe(true);
  });
});

describe('writeSetting', () => {
  it('stores one key', async () => {
    const { data, area } = mockChromeStorage();
    await writeSetting('local', 'volume', { level: 0.5, muted: false });
    expect(area.set).toHaveBeenCalledWith({ volume: { level: 0.5, muted: false } });
    expect(data.volume).toEqual({ level: 0.5, muted: false });
  });

  it('logs instead of throwing when storage fails', async () => {
    const { area } = mockChromeStorage();
    area.set.mockRejectedValueOnce(new Error('quota'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(writeSetting('sync', 'redirectEnabled', false)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('does nothing outside the extension', async () => {
    vi.stubGlobal('chrome', undefined);
    await expect(writeSetting('sync', 'redirectEnabled', false)).resolves.toBeUndefined();
  });

  it('round-trips with readSetting', async () => {
    mockChromeStorage();
    await writeSetting('sync', 'redirectEnabled', false);
    await expect(readSetting('sync', 'redirectEnabled', true, isBoolean)).resolves.toBe(false);
  });
});

describe('guards', () => {
  it('validate stored shapes', () => {
    expect(isVolumeSetting({ level: 1, muted: false })).toBe(true);
    expect(isVolumeSetting({ level: 1 })).toBe(false);
    expect(isVolumeSetting(null)).toBe(false);
    expect(isSavedPositions({})).toBe(true);
    expect(isSavedPositions({ a: { time: 1, at: 2 } })).toBe(true);
    expect(isSavedPositions({ a: { time: 1 } })).toBe(false);
    expect(isSavedPositions([])).toBe(false);
  });
});
