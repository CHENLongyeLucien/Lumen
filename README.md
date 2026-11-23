# Lumen

A minimalist video player for Chrome (Manifest V3). When you open a video file in Chrome (a local `file:///…` file or a direct link to an `.mp4`, `.webm`, etc.), Lumen opens it in its own clean, dark player instead of Chrome's built-in one.

Plain HTML/CSS/JS with no build step, no dependencies and no network calls.

## Install

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select this folder (the one that contains `manifest.json`).
4. In Lumen's **Details**, turn on **Allow access to file URLs**. Without it, Lumen shows a help page instead.
5. Open a local video file in Chrome (drag it into a tab, or press `Ctrl+O`). The Lumen player should appear.

After you change `background.js` or `manifest.json`, click **Reload** on the extension card.

## Features

- **Redirect**: `mp4, m4v, webm, ogv, ogg, mov` over `file://`, `http://` and `https://`. You can turn it off from the toolbar popup.
- **Controls**: play/pause, a progress bar you can click or drag (shows what's buffered, with a time bubble on hover), elapsed/total time, volume with mute (remembered), speed (presets from 0.25x to 4x plus any value from 0.1x to 16x), fullscreen and Picture-in-Picture.
- **Auto-hide**: the controls and the cursor fade after 3 seconds without mouse movement while playing.
- **Double-click**: on the left or right third, −10 s / +10 s; in the middle, fullscreen.
- **A-B loop**: the `A-B` button sets A, then B, then turns the loop off.
- **Resume**: playback restarts where you left off (for videos longer than 30 s).
- **Frame by frame** with `,` and `.`.
- **Settings menu** (sliders icon): screenshot (PNG), subtitles, video info, rotation, mirror, brightness/contrast/saturation.
- **Subtitles**: drop an `.srt` or `.vtt` file onto the player, or use the CC button. SRT files are converted to WebVTT automatically.
- **Watch page**: the video sits on a minimal page, like a video site without the clutter. Below it you get the title, the file date ("Saved" for local files, "Uploaded" for web links when the server sends one), duration, quality (720p, 1080p, 4K…), format and size, plus an expandable details box.
- **Theater mode** (`T`): a full-width video. The choice is remembered.
- **Appearance** (palette icon in the header): light, dark or system theme, and an accent color (amber, orange, red, pink, purple, blue, green or white). The video player itself always stays dark. The choice applies to every Lumen page.
- **Draw on the video** (`D` or the pen button): pen, highlighter, eraser, 8 colors, brush size, undo (`Ctrl+Z`) and clear. Drawings stay in place when you resize or zoom, and they are included in screenshots.
- **Zoom**: `Ctrl` + scroll (or pinch on a trackpad), `+` / `-`, or the Zoom button. While zoomed, drag the video to move around.
- **Automatic captions**: the subtitles menu → *Automatic captions…* opens Chrome's **Live Caption** setting. Chrome then captions any video automatically, offline.
- **Fallback**: with no video, or after an error, a drop zone and an **Open a file** button appear.
- **Errors**: separate messages for unsupported formats, missing or unreadable files, corrupted files and network problems.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` / `K` | Play / pause |
| `←` / `→` | −5 s / +5 s |
| `J` / `L` | −10 s / +10 s |
| `↑` / `↓` | Volume +5% / −5% |
| `M` | Mute |
| `F` | Fullscreen |
| `P` | Picture-in-Picture |
| `<` / `>` | Speed down / up |
| `,` / `.` | Previous / next frame |
| `T` | Theater mode |
| `D` | Draw on the video |
| `C` | Subtitles on / off |
| `+` / `-` | Zoom in / out |
| `0`–`9` | Jump to 0% … 90% |
| `Esc` | Close a menu, the info panel or the drawing tools / exit fullscreen |

Shortcuts are ignored while you type in a text field (for example the custom speed box).

## Project structure

```
manifest.json        permissions: webNavigation, storage; host: file:///* only
background.js        service worker: detects video navigations, redirects, anti-loop
popup/               toolbar popup: on/off switch, file-access status, open player
shared/
  theme.css          light/dark tokens and accent colors (used by every page)
  theme-boot.js      applies the saved theme before the page paints
player/
  player.html        watch page: header, player, details
  page.css           page layout, header, details, theater mode
  player.css         player internals (always dark), menus, drawing tools
  player.js          entry point: wires the modules together
  appearance.js      theme + accent color menu
  layout.js          default view / theater mode
  details.js         title, date, size, quality, description box
  annotate.js        drawing layer (pen, highlighter, eraser)
  zoom.js            zoom and pan
  controls.js        play, progress, time, volume, fullscreen, PiP, auto-hide
  speed.js           speed menu + custom value
  shortcuts.js       keyboard shortcuts
  subtitles.js       .srt/.vtt loading, SRT → WebVTT
  source.js          ?src= loading, drag and drop, file picker, error messages
  extras.js          A-B loop, frame step, screenshot, remembered position
  settings.js        settings menu, rotation/mirror/filters, info panel
  icons.js           inline SVG icons
  utils.js           time formatting, storage, toast, popover menus
welcome/             help page for "Allow access to file URLs"
icons/               16/32/48/128 PNG + logo.png (512 px light bulb)
```

The extension asks for the fewest permissions it can. `tabs` isn't needed (`tabs.update` and `tabs.create` work without it), and the only host permission is `file:///*`, which makes Chrome show the file-access toggle. Web links don't need a host permission.

## Manual test guide

Get two sample files ready: a short `.mp4` (H.264), and a file Chrome can't decode (for example an `.mkv` with H.265, or any non-video file renamed to `.mp4`).

1. **Loading**: load the extension. Its card shows no errors. Open the *service worker* link and check that its console is clean.
2. **Help page**: with *Allow access to file URLs* **off**, open a local `.mp4`. Either the Lumen help page opens, or Chrome's native player stays; see Limitations. The popup shows "Local file access disabled".
3. **Local file**: turn the setting **on** and open the `.mp4` again. The Lumen player appears and the tab title is the file name.
4. **Direct link**: open an `https://…/something.mp4` link. It redirects to Lumen.
5. **Popup**: click the icon and turn off *Open videos with Lumen*. Open the video again: Chrome's native player is used. Turn it back on.
6. **Basic controls**: try play/pause (button, click on the video, `Space`), clicking and dragging the progress bar (watch the hover bubble and the buffered bar), and volume and mute. Reload the page: the volume is the same.
7. **Speed**: pick `1.5x` from the menu, then type `7.3` in *Custom*. The button shows `7.3x`. Press `<` and `>`.
8. **Fullscreen / PiP**: try the buttons, `F`, a double-click in the middle, and `P`.
9. **Shortcuts**: go through every line of the table above. While the custom speed box has focus, letters don't trigger shortcuts.
10. **Auto-hide**: during playback, keep the mouse still for 3 seconds. The UI and cursor disappear, and moving the mouse brings them back. While paused, the UI stays.
11. **Errors**: open the unsupported file. A clear message appears with an *Open a file* button. Then open `file:///C:/does-not-exist.mp4`: you get "File not found or inaccessible".
12. **Drag and drop**: drop a video onto the player and it plays. Drop an `.srt` file and the subtitles appear (the CC button turns amber).
13. **Watch page**: the title, date, duration, quality and size show under the video. Press `T` for theater mode, then `T` again to go back.
14. **Appearance**: switch to the light theme and pick a few accent colors. The progress bar, the buttons and the popup all change.
15. **Draw / zoom**: press `D`, draw, erase and undo, then press `Esc`. `Ctrl` + scroll to zoom, then drag to pan: the drawing stays on the same spot of the picture.
16. **Extras**: try double-clicking the left and right sides, the A-B loop, a screenshot (a PNG is downloaded), rotate and mirror, the image sliders, and the info panel. Close the tab mid-video and reopen the file: playback resumes.
17. **Consoles**: the player's DevTools console and the service worker console show no errors.

## Limitations

- Lumen depends on Chrome's codecs. MP4 (H.264/AAC) and WebM (VP8/VP9/AV1) are fine. MKV, AVI and H.265 depend on the machine, and sometimes only the audio plays (Lumen warns you when that happens).
- Local files need *Allow access to file URLs*. Without it, Chrome doesn't tell the extension about `file://` navigations at all. In that case the help page is shown on install and from the popup.
- Streaming platforms (YouTube, Netflix, DRM) are out of scope.
- If another extension also redirects the same navigation, the result is unpredictable.
- Plain `http://` links can be blocked or upgraded to `https://` by Chrome's mixed-content rules, because the player page is a secure context.
- Screenshots of videos from another website can be blocked by that site (cross-origin).
- Automatic captions rely on Chrome's Live Caption. It supports a limited set of languages and makes you pick the language in Chrome's settings rather than detecting it.
- File dates for local files come from Chrome's folder listing page. If Chrome can't read the folder, the date is simply not shown.
- Not implemented yet from spec §5.2: volume boost above 100% (Web Audio) and the "Download" button for web links.

## License

[MIT](LICENSE)
