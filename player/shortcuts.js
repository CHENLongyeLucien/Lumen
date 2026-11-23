// Keyboard shortcuts (README section 5.3, plus "," / "." frame by frame).

/** True when the key press is meant for a text field. */
function isEditable(el) {
  if (!el || el === document.body) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName === 'INPUT') return !['range', 'checkbox', 'radio', 'button'].includes(el.type);
  return false;
}

export function initShortcuts(api) {
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isEditable(event.target)) {
      if (event.key === 'Escape') event.target.blur();
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

function handleKey(event, api) {
  if (event.key === 'Escape') return api.escape();
  if (!api.hasSource()) return false;

  // 0-9: jump to 0%…90%. Uses the physical key so it also works on AZERTY.
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(event.code);
  if (digit && (event.code.startsWith('Digit') || /^\d$/.test(event.key))) {
    api.seekToFraction(Number(digit[1]) / 10);
    return true;
  }

  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const once = !event.repeat; // toggles should not repeat while the key is held

  switch (key) {
    case ' ':
    case 'k':
      if (once) api.togglePlay({ flash: true });
      return true;
    case 'ArrowLeft': api.seekBy(-5); return true;
    case 'ArrowRight': api.seekBy(5); return true;
    case 'j': api.seekBy(-10); return true;
    case 'l': api.seekBy(10); return true;
    case 'ArrowUp': api.changeVolume(0.05); return true;
    case 'ArrowDown': api.changeVolume(-0.05); return true;
    case 'm':
      if (once) api.toggleMute({ announce: true });
      return true;
    case 'f':
      if (once) api.toggleFullscreen();
      return true;
    case 'p':
      if (once) api.togglePip();
      return true;
    case '<': api.stepSpeed(-1); return true;
    case '>': api.stepSpeed(1); return true;
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
    case ',': api.stepFrame(-1); return true;
    case '.': api.stepFrame(1); return true;
    default: return false;
  }
}
