# Lumen

[![CI](https://github.com/CHENLongyeLucien/Lumen/actions/workflows/ci.yml/badge.svg)](https://github.com/CHENLongyeLucien/Lumen/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-4285F4)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)

A minimalist video player for Chrome. When you open a video file in Chrome (a local `file:///…` file or a direct link to an `.mp4`, `.webm`, etc.), Lumen opens it in its own clean, modern player instead of Chrome's built-in one. There are no recommendations, no tracking and no accounts.

## Overview

Lumen is a Chrome extension (Manifest V3) written in strict TypeScript, with no runtime dependencies. A service worker spots navigations to direct video files and redirects the tab to Lumen's player page. There, a hand-built player (no player library) adds the controls, shortcuts and tools Chrome's native player lacks.

## Features

**Playback**

- Play/pause, a progress bar you can click or drag (shows the buffered range, with a time bubble on hover), elapsed/total time.
- Volume and mute (remembered between sessions).
- Speed: presets from 0.25x to 4x, or any value from 0.1x to 16x.
- Fullscreen and Picture-in-Picture.
- Double-click the left or right side to skip −10 s / +10 s; double-click the middle for fullscreen.
- A-B loop, frame-by-frame stepping, and playback that resumes where you left off (videos of 30 s or more).

**Watch page**

- A minimal page: the title, file date ("Saved" / "Uploaded"), duration, quality, format and size, and an expandable details box.
- Default view or theater mode (`T`); auto-hiding controls and cursor while playing.

**Tools**

- Draw on the video: pen, highlighter, eraser, 8 colors, brush size, undo and clear. Drawings follow resize and zoom, and screenshots include them.
- Zoom up to 800% (`Ctrl` + scroll, pinch, `+` / `-`) and drag to pan.
- Screenshot to PNG; rotate, mirror, brightness, contrast and saturation; an info panel.
- Subtitles: `.srt` (converted to WebVTT) or `.vtt`, by drag and drop or from the CC menu. The CC menu also links to Chrome's Live Caption for automatic captions.

**Appearance and access**

- Light, dark or system theme, and 8 accent colors (amber, orange, red, pink, purple, blue, green, white).
- Keyboard-first: every action has a shortcut, and popovers support arrow keys, focus return and visible focus rings. Respects _prefers-reduced-motion_.
- Clear error screens for unsupported formats, missing files, corrupted files and network errors, with a drop zone to open another file.
- **Download web videos**: when a posted link can't play inside Lumen (sign-in needed, the site blocks embedding, unsupported format), _Download the video_ saves it with Chrome's own downloader, which uses your cookies. Then _Play the downloaded video_ opens the local copy. The same option is in the Settings menu and under the video for any web link.

### Keyboard shortcuts

| Key           | Action                                                              |
| ------------- | ------------------------------------------------------------------- |
| `Space` / `K` | Play / pause                                                        |
| `←` / `→`     | −5 s / +5 s                                                         |
| `J` / `L`     | −10 s / +10 s                                                       |
| `↑` / `↓`     | Volume +5% / −5%                                                    |
| `M`           | Mute                                                                |
| `F`           | Fullscreen                                                          |
| `P`           | Picture-in-Picture                                                  |
| `<` / `>`     | Speed down / up                                                     |
| `,` / `.`     | Previous / next frame                                               |
| `0`–`9`       | Jump to 0% … 90% (physical keys, so AZERTY works)                   |
| `T`           | Theater mode                                                        |
| `D`           | Draw on the video                                                   |
| `C`           | Subtitles on / off                                                  |
| `+` / `-`     | Zoom in / out                                                       |
| `Esc`         | Close a menu, the info panel or the drawing tools / exit fullscreen |

Shortcuts are ignored while you type in a text field.

## Install from source

You need [Node.js](https://nodejs.org) 22 or later (CI uses the version in [`.nvmrc`](.nvmrc)) and [pnpm](https://pnpm.io) 10.

```sh
git clone https://github.com/CHENLongyeLucien/Lumen.git
cd Lumen
pnpm install
pnpm build
```

Then load it in Chrome:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the **`dist/`** folder (not the repository root).
3. In Lumen's **Details**, turn on **Allow access to file URLs** so it can open local videos.
4. Open a local video file in Chrome. The Lumen player should appear.

Each CI run also uploads a ready-to-load `dist/` as a zipped artifact (on the workflow run page, under _Artifacts_).

## Development

| Command             | What it does                                                                      |
| ------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`          | Rebuilds `dist/` on every change (then click **Reload** in `chrome://extensions`) |
| `pnpm build`        | Production build into `dist/`                                                     |
| `pnpm test`         | Runs the Vitest unit tests once                                                   |
| `pnpm test:watch`   | Runs the tests in watch mode                                                      |
| `pnpm coverage`     | Tests with V8 coverage, plus a per-file summary (HTML report in `coverage/`)      |
| `pnpm lint`         | ESLint (typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`)           |
| `pnpm typecheck`    | `tsc --noEmit` for the sources/tests and for the tool configs                     |
| `pnpm format`       | Formats everything with Prettier                                                  |
| `pnpm format:check` | Checks formatting (used by CI)                                                    |

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs format check, lint, typecheck, tests with coverage, and build on every push and pull request.

## Architecture

### Service worker flow

```
user opens a video URL
        │
        ▼
webNavigation.onBeforeNavigate  (background.ts)
        │  shouldRedirect(): main frame? real tab? not a prerender?
        │                    not a Lumen page (anti-loop)? URL ends in a video extension?
        │  redirect switch on? (chrome.storage.sync, cached, updated by storage.onChanged)
        ▼
file:// URL and no file access? ──yes──▶ welcome/welcome.html?src=<url>   (how to enable access)
        │ no
        ▼
tabs.update → player/player.html?src=<url>
        │
        ▼
player.ts wires the modules; source.ts reads ?src= and sets <video src>
```

The redirect logic itself lives in [`src/shared/video-url.ts`](src/shared/video-url.ts) and is fully unit-tested.

### How the parts communicate

There is no runtime message passing (`chrome.runtime.sendMessage`): nothing needs a request/response. The contexts share state through three typed channels, all defined in [`src/shared/types.ts`](src/shared/types.ts):

| Channel                | Writer → reader                        | Contents                                                      |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------- |
| `chrome.storage.sync`  | popup → service worker                 | `redirectEnabled`                                             |
| `chrome.storage.local` | player → player                        | `volume` (level, muted), `positions` (resume points, max 200) |
| Page URL `?src=`       | service worker → player / welcome page | the original video URL                                        |
| `localStorage`         | any page → every page                  | `lumen.appearance` (theme, accent), `lumen.theater`           |

Stored values are untrusted, so every read goes through a runtime guard ([`src/shared/storage.ts`](src/shared/storage.ts)).

### Module map

```
src/
  background.ts            service worker: redirect + first-install help page
  shared/
    types.ts               storage schemas, page URLs, appearance types, runtime guards
    storage.ts             typed chrome.storage read/write helpers
    video-url.ts           video URL detection, redirect/anti-loop guard        (pure)
    appearance-state.ts    theme parsing and resolution                          (pure)
    theme-boot.ts          applies theme/accent before paint (classic script)
    theme.css              light/dark tokens, accent colors, reduced motion
  popup/                   toolbar popup: redirect switch, file-access status
  welcome/                 "Allow access to file URLs" help page + shortcuts
  player/
    player.ts              entry point: creates the context, wires every module
    context.ts             PlayerContext + source-change emitter
    source.ts              ?src= loading, dropzone, error screen
    file-drop.ts           file picker and page-wide drag and drop
    errors.ts              media error → category → message                     (pure)
    controls.ts            play/pause, seeking, clicks, fullscreen, PiP, auto-hide
    progress.ts            progress bar, time, scrubbing
    volume.ts              volume slider, mute, saved level
    timing.ts              debounce + auto-hide controller                       (pure)
    speed.ts / speed-logic.ts         speed popover / presets and clamping       (pure)
    shortcuts.ts           keyboard map
    subtitles.ts / subtitle-format.ts subtitles menu / SRT→VTT and decoding      (pure)
    ab-loop.ts, frames.ts  A-B loop; frame rate estimate and frame stepping
    position-memory.ts / resume.ts    saved positions / the 30-second rules      (pure)
    screenshot.ts          PNG capture (with filters and drawings)
    annotate.ts / strokes.ts          drawing tools / stroke model and rendering
    zoom.ts                zoom and pan
    settings.ts            settings popover, rotation/mirror/filters, info panel
    details.ts / file-stat.ts         details under the video / file date parsing (pure)
    format.ts              time, size, date, file-name helpers                   (pure)
    download.ts / download-name.ts    download a web link / file names and paths  (pure)
    layout.ts, appearance.ts          theater mode; theme and accent menu
    icons.ts, utils.ts     inline SVG icons; DOM helpers, toast, popovers
public/
  manifest.json, icons/    copied as-is into dist/
```

**Build:** Vite bundles the three pages (player, popup, welcome) into `dist/`. A small Vite plugin uses esbuild to emit `background.js` and `shared/theme-boot.js` as classic IIFE scripts at the fixed paths the manifest and the HTML expect.

## Testing

```sh
pnpm test        # 144 tests in 11 files
pnpm coverage    # same, with coverage
```

The unit tests cover the logic that can run without a browser:

- SRT → WebVTT (BOM, CRLF/CR, missing index, overlapping cues, malformed timestamps) and text decoding (UTF-8, UTF-16, Windows-1252)
- Video URL detection and the service worker's redirect and anti-loop guard
- Resume rules (30-second rule, start/end margins, pruning to 200 entries)
- Speed clamping, presets, stepping and input parsing
- Time, size, date and file-name formatting
- Storage helpers against a mocked `chrome.storage`
- Media-error mapping
- Auto-hide and debounce (fake timers), directory-listing parsing, appearance parsing
- Download file names, downloaded-file paths to `file://` URLs, progress text
- The whole keyboard map, in jsdom

**Coverage:** the 13 logic modules above are at **99.2 % of lines** and **92.8 % of branches**. Across all of `src/` the figure is **15.1 % of lines**, because the DOM-wiring modules (controls, drawing, zoom, pages…) are checked with the manual test guide below rather than unit tests.

### Manual test guide

**Automated** marks the parts now covered by unit tests. Those steps still need a quick look in Chrome, but the logic behind them is checked on every commit.

| #   | Step                                                                                                                                                                                                     | Automated                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | **Loading**: load `dist/`. The card shows no errors, and the _service worker_ console is clean.                                                                                                          | Build only (CI)                                         |
| 2   | **Help page**: with _Allow access to file URLs_ **off**, open a local `.mp4`. The help page opens (or Chrome's player stays; see Limitations). The popup shows "Local file access disabled".             | —                                                       |
| 3   | **Local file**: turn access **on**, open the `.mp4` again. The player appears and the tab title is the file name.                                                                                        | URL detection, file-name decoding                       |
| 4   | **Direct link**: open `https://…/something.mp4`. It redirects to Lumen.                                                                                                                                  | URL detection (query, hash, case), anti-loop            |
| 5   | **Popup**: turn off _Open videos with Lumen_, open the video again (native player), then turn it back on.                                                                                                | Storage helpers                                         |
| 6   | **Basic controls**: play/pause (button, click, `Space`), drag the progress bar (bubble and buffered bar), volume and mute. Reload: the volume is kept.                                                   | Time formatting, volume storage, debounce               |
| 7   | **Speed**: pick `1.5x`, type `7.3` in _Custom_ (the button shows `7.3x`), then press `<` and `>`.                                                                                                        | Clamping, presets, stepping, input parsing              |
| 8   | **Fullscreen / PiP**: the buttons, `F`, a double-click in the middle, `P`.                                                                                                                               | Shortcut mapping                                        |
| 9   | **Shortcuts**: every line of the table. Letters do nothing while the custom speed box has focus.                                                                                                         | **Fully** (key map, AZERTY digits, repeat, text fields) |
| 10  | **Auto-hide**: keep the mouse still for 3 s while playing; the UI and cursor hide, and moving brings them back. Paused: the UI stays.                                                                    | Auto-hide timing and conditions                         |
| 11  | **Errors**: open an unsupported file, then `file:///C:/does-not-exist.mp4` ("File not found or inaccessible"). Open a web link that fails, click _Download the video_, then _Play the downloaded video_. | Error category and message mapping                      |
| 12  | **Drag and drop**: drop a video, then an `.srt`. Subtitles appear and CC turns to the accent color.                                                                                                      | SRT → VTT conversion, decoding                          |
| 13  | **Watch page**: title, date, duration, quality and size under the video. `T` toggles theater mode.                                                                                                       | Date, size, quality formatting; listing parsing         |
| 14  | **Appearance**: light theme and a few accent colors. The player, page and popup follow.                                                                                                                  | Appearance parsing and theme resolution                 |
| 15  | **Draw / zoom**: `D`, draw, erase, undo, `Esc`. `Ctrl` + scroll to zoom, drag to pan; the drawing stays on the picture.                                                                                  | —                                                       |
| 16  | **Extras**: side double-clicks, A-B loop, screenshot, rotate/mirror, image sliders, info panel. Close mid-video and reopen: playback resumes.                                                            | Resume rules                                            |
| 17  | **Consoles**: no errors in the player console or the service worker console.                                                                                                                             | —                                                       |

## Limitations

- Lumen depends on Chrome's codecs. MP4 (H.264/AAC) and WebM (VP8/VP9/AV1) are fine. MKV, AVI and H.265 depend on the machine, and sometimes only the audio plays (Lumen warns you when that happens).
- Local files need _Allow access to file URLs_. Without it, Chrome doesn't tell the extension about `file://` navigations at all. In that case the help page is shown on install and from the popup.
- Streaming platforms (YouTube, Netflix, DRM) are out of scope.
- If another extension also redirects the same navigation, the result is unpredictable.
- Plain `http://` links can be blocked or upgraded to `https://` by Chrome's mixed-content rules, because the player page is a secure context.
- Screenshots of videos from another website can be blocked by that site (cross-origin).
- Automatic captions rely on Chrome's Live Caption. It supports a limited set of languages and makes you pick the language in Chrome's settings rather than detecting it.
- File dates for local files come from Chrome's folder listing page. If Chrome can't read the folder, the date is simply not shown.
- Not implemented yet from spec §5.2: volume boost above 100% (Web Audio).
- Downloading a link only works if Chrome itself can download it: links that expire, need a special player, or stream in pieces (HLS/DASH) can't be saved.

## Privacy

- No analytics, telemetry, accounts or remote scripts. Everything ships inside the extension, and the CSP is `script-src 'self'; object-src 'self'`.
- Permissions: `webNavigation` (to spot video links), `storage` (settings, volume, resume points), `downloads` (only used when you click _Download_) and the `file:///*` host permission (so Chrome offers _Allow access to file URLs_).
- Everything stays in your browser: settings and resume points in `chrome.storage`, appearance in `localStorage`. Resume points store the video URL or file name and a time.
- The only requests Lumen makes are about the video you opened:
  - For a web link, a `HEAD` request to that same URL, to show its upload date and size.
  - For a local file, a read of its folder's listing page, to show its date.
  - When you click _Download_, Chrome downloads that same URL into your Downloads folder.
  - Nothing is sent anywhere else.

## License

[MIT](LICENSE)
