// Keyboard shortcuts (README table, plus "," / "." frame by frame).

export interface ShortcutActions {
  hasSource: () => boolean;
  escape: () => boolean;
  togglePlay: (options: { flash: boolean }) => void;
  seekBy: (delta: number) => void;
  seekToFraction: (fraction: number) => void;
  changeVolume: (delta: number) => void;
  toggleMute: (options: { announce: boolean }) => void;
  toggleFullscreen: () => void;
  togglePip: () => void;
  toggleTheater: () => void;
  toggleDraw: () => void;
  toggleSubtitles: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  stepSpeed: (direction: number) => void;
  stepFrame: (direction: number) => void;
}

/** True when the key press is meant for a text field. */
function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement) || el === document.body) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !['range', 'checkbox', 'radio', 'button'].includes(el.type);
  return false;
}

export function initShortcuts(api: ShortcutActions): void {
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isEditable(event.target)) {
      if (event.key === 'Escape' && event.target instanceof HTMLElement) event.target.blur();
      return;
    }
    if (handleKey(event, api)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  // Prevent Space from also "clicking" a focused button on key up.
  document.addEventListener('keyup', (event) => {
    if (event.key === ' ' && !isEditable(event.target)) event.preventDefault();
  });
}

function handleKey(event: KeyboardEvent, api: ShortcutActions): boolean {
  if (event.key === 'Escape') return api.escape();
  if (!api.hasSource()) return false;

  // 0-9: jump to 0%…90%. Uses the physical key so it also works on AZERTY.
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(event.code)?.[1];
  if (digit !== undefined && (event.code.startsWith('Digit') || /^\d$/.test(event.key))) {
    api.seekToFraction(Number(digit) / 10);
    return true;
  }

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const once = !event.repeat; // toggles should not repeat while the key is held

  switch (key) {
    case ' ':
    case 'k':
      if (once) api.togglePlay({ flash: true });
      return true;
    case 'ArrowLeft':
      api.seekBy(-5);
      return true;
    case 'ArrowRight':
      api.seekBy(5);
      return true;
    case 'j':
      api.seekBy(-10);
      return true;
    case 'l':
      api.seekBy(10);
      return true;
    case 'ArrowUp':
      api.changeVolume(0.05);
      return true;
    case 'ArrowDown':
      api.changeVolume(-0.05);
      return true;
    case 'm':
      if (once) api.toggleMute({ announce: true });
      return true;
    case 'f':
      if (once) api.toggleFullscreen();
      return true;
    case 'p':
      if (once) api.togglePip();
      return true;
    case 't':
      if (once) api.toggleTheater();
      return true;
    case 'd':
      if (once) api.toggleDraw();
      return true;
    case 'c':
      if (once) api.toggleSubtitles();
      return true;
    case '+':
    case '=':
      api.zoomIn();
      return true;
    case '-':
      api.zoomOut();
      return true;
    case '<':
      api.stepSpeed(-1);
      return true;
    case '>':
      api.stepSpeed(1);
      return true;
    case ',':
      api.stepFrame(-1);
      return true;
    case '.':
      api.stepFrame(1);
      return true;
    default:
      return false;
  }
}
