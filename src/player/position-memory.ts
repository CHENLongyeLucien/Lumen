// Remembers the playback position per video (chrome.storage.local) and resumes it.

import { readSetting, writeSetting } from '../shared/storage';
import { isSavedPositions, type SavedPositions } from '../shared/types';
import type { PlayerContext } from './context';
import { formatTime } from './format';
import { isRememberable, positionToSave, shouldRestore, updatePositions } from './resume';
import { showToast } from './utils';

const SAVE_INTERVAL_MS = 5000;

export function initPositionMemory(ctx: PlayerContext, { isLooping }: { isLooping: () => boolean }): void {
  const { video } = ctx;
  let positionKey: string | null = null;
  let restorePromise: Promise<number | null> | null = null;
  let canSave = false; // only after the restore attempt, so a fresh start does not erase the saved spot
  let lastSaveAt = 0;
  let writeChain: Promise<void> = Promise.resolve();

  const readPositions = (): Promise<SavedPositions> =>
    readSetting('local', 'positions', {}, isSavedPositions);

  /** Serializes read-modify-write cycles so concurrent saves cannot overwrite each other. */
  function writePosition(key: string, time: number | null): void {
    writeChain = writeChain
      .then(async () => {
        const all = await readPositions();
        await writeSetting('local', 'positions', updatePositions(all, key, time, Date.now()));
      })
      .catch(() => undefined);
  }

  function savePosition(force = false): void {
    if (!canSave || !positionKey || !isRememberable(video.duration)) return;
    const now = Date.now();
    if (!force && now - lastSaveAt < SAVE_INTERVAL_MS) return;
    lastSaveAt = now;
    writePosition(positionKey, positionToSave(video.currentTime, video.duration));
  }

  async function restorePosition(): Promise<void> {
    const pending = restorePromise;
    restorePromise = null;
    if (!pending) return;
    const time = await pending;
    canSave = true;
    if (!shouldRestore(time, video.duration)) return;
    video.currentTime = time;
    showToast(`Resumed at ${formatTime(time, video.duration >= 3600)} · press 0 to start over`, 3500);
  }

  ctx.onSourceChange((source) => {
    savePosition(true); // keep the previous file's position
    const key = source.key;
    positionKey = key;
    restorePromise = readPositions().then((all) => all[key]?.time ?? null);
    canSave = false;
    lastSaveAt = 0;
  });

  video.addEventListener('loadedmetadata', () => {
    void restorePosition();
  });
  video.addEventListener('timeupdate', () => {
    savePosition();
  });
  video.addEventListener('pause', () => {
    savePosition(true);
  });
  video.addEventListener('ended', () => {
    if (positionKey && !isLooping()) writePosition(positionKey, null);
  });
  window.addEventListener('pagehide', () => {
    savePosition(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') savePosition(true);
  });
}
