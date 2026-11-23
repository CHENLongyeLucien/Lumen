// Inline SVG icons (24x24 viewBox, drawn with currentColor).

const svg = (body: string): string =>
  `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">${body}</svg>`;

const stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const speaker =
  '<path d="M4 9.5v5a1 1 0 0 0 1 1h3l4.4 3.6a.6.6 0 0 0 1-.46V5.36a.6.6 0 0 0-1-.46L8 8.5H5a1 1 0 0 0-1 1z" fill="currentColor"/>';
const label10 =
  '<text x="12" y="15.4" text-anchor="middle" font-size="7.5" font-weight="700" font-family="system-ui, sans-serif" fill="currentColor">10</text>';

export const icons = {
  play: svg('<path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.2-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6z" fill="currentColor"/>'),
  pause: svg('<rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/>'),
  back10: svg(`<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" ${stroke}/><path d="M6.5 2.8v4h4" ${stroke}/>${label10}`),
  forward10: svg(`<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" ${stroke}/><path d="M17.5 2.8v4h-4" ${stroke}/>${label10}`),
  volumeHigh: svg(`${speaker}<path d="M16 9a4 4 0 0 1 0 6" ${stroke}/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" ${stroke}/>`),
  volumeLow: svg(`${speaker}<path d="M16 9a4 4 0 0 1 0 6" ${stroke}/>`),
  volumeMute: svg(`${speaker}<path d="M16.5 9.5l5 5M21.5 9.5l-5 5" ${stroke}/>`),
  fullscreen: svg(`<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" ${stroke}/>`),
  fullscreenExit: svg(`<path d="M9 4v4a1 1 0 0 1-1 1H4M20 9h-4a1 1 0 0 1-1-1V4M15 20v-4a1 1 0 0 1 1-1h4M4 15h4a1 1 0 0 1 1 1v4" ${stroke}/>`),
  pip: svg(`<rect x="3" y="5" width="18" height="14" rx="2" ${stroke}/><rect x="12" y="11.5" width="6.5" height="5" rx="1" fill="currentColor"/>`),
  subtitles: svg(`<rect x="3" y="5" width="18" height="14" rx="2.5" ${stroke}/><path d="M7 12.5h3M13 12.5h4M7 15.5h6M15.5 15.5h1.5" ${stroke}/>`),
  settings: svg(`<path d="M4 7h9M17 7h3M4 17h3M11 17h9" ${stroke}/><circle cx="15" cy="7" r="2" ${stroke}/><circle cx="9" cy="17" r="2" ${stroke}/>`),
  camera: svg(`<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2L9 5h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" ${stroke}/><circle cx="12" cy="13" r="3.2" ${stroke}/>`),
  info: svg(`<circle cx="12" cy="12" r="9" ${stroke}/><path d="M12 11v5.5M12 7.6v.1" ${stroke}/>`),
  rotate: svg(`<path d="M20 12a8 8 0 1 1-2.4-5.7" ${stroke}/><path d="M18 2.5v4.2h-4.2" ${stroke}/>`),
  mirror: svg(`<path d="M12 3v18" ${stroke} stroke-dasharray="2 2.5"/><path d="M9 7L3.5 17H9zM15 7l5.5 10H15z" ${stroke}/>`),
  reset: svg(`<path d="M4 12a8 8 0 1 0 2.4-5.7" ${stroke}/><path d="M6 2.5v4.2h4.2" ${stroke}/>`),
  film: svg(`<rect x="3" y="4" width="18" height="16" rx="2.5" ${stroke}/><path d="M7.5 4v16M16.5 4v16M3 9h4.5M3 15h4.5M16.5 9H21M16.5 15H21" ${stroke}/>`),
  close: svg(`<path d="M6 6l12 12M18 6L6 18" ${stroke}/>`),
  pen: svg(`<path d="M4 20l1.2-4.3L16.4 4.5a2.1 2.1 0 0 1 3 3L8.3 18.8z" ${stroke}/><path d="M14.5 6.5l3 3" ${stroke}/>`),
  highlighter: svg(`<path d="M15 4l5 5-8 8H7v-5z" ${stroke}/><path d="M4 20h8" ${stroke}/>`),
  eraser: svg(`<path d="M9 20h11" ${stroke}/><path d="M4.6 13.4l8.8-8.8a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L12 18H8.2a2 2 0 0 1-1.4-.6l-2.2-2.2a2 2 0 0 1 0-2.8z" ${stroke}/><path d="M9 9l6 6" ${stroke}/>`),
  undo: svg(`<path d="M9 14L4 9l5-5" ${stroke}/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" ${stroke}/>`),
  trash: svg(`<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" ${stroke}/>`),
  zoomIn: svg(`<circle cx="11" cy="11" r="7" ${stroke}/><path d="M20 20l-4-4M11 8v6M8 11h6" ${stroke}/>`),
  zoomOut: svg(`<circle cx="11" cy="11" r="7" ${stroke}/><path d="M20 20l-4-4M8 11h6" ${stroke}/>`),
  theater: svg(`<rect x="2.5" y="6" width="19" height="12" rx="2" ${stroke}/>`),
  defaultView: svg(`<rect x="5" y="7.5" width="14" height="9" rx="2" ${stroke}/>`),
  palette: svg(`<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.9 1.4-1.8-.4-1.1.3-2.2 1.5-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z" ${stroke}/><circle cx="7.5" cy="11" r="1.3" fill="currentColor"/><circle cx="10" cy="7.3" r="1.3" fill="currentColor"/><circle cx="14.6" cy="7.5" r="1.3" fill="currentColor"/>`),
  sun: svg(`<circle cx="12" cy="12" r="4" ${stroke}/><path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" ${stroke}/>`),
  moon: svg(`<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" ${stroke}/>`),
  folder: svg(`<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" ${stroke}/>`),
  sparkle: svg(`<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" ${stroke}/>`),
} as const;

export type IconName = keyof typeof icons;

const isIconName = (name: string | undefined): name is IconName => name !== undefined && name in icons;

/** Fills every element carrying data-icon="name" with the matching SVG. */
export function injectIcons(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-icon]')) {
    const name = el.dataset.icon;
    if (isIconName(name)) el.insertAdjacentHTML('afterbegin', icons[name]);
  }
}
