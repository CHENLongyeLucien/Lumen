// Video source: reads ?src=, opens dropped/picked files, shows the
// dropzone (empty state) and readable error messages.

import { SOURCE_PARAM, WELCOME_PAGE } from '../shared/types';
import type { PlayerContext, VideoSource } from './context';
import { $, extensionOf, fileNameFromUrl, showToast } from './utils';

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'm4v', 'webm', 'ogv', 'ogg', 'mov', 'mkv', 'avi', '3gp', 'ts', 'm2ts', 'mts',
  'flv', 'wmv', 'mpg', 'mpeg', 'hevc', 'm4a', 'mp3', 'wav', 'flac', 'opus',
]);
const AUDIO_EXTENSIONS = new Set(['ogg', 'm4a', 'mp3', 'wav', 'flac', 'opus']);
const SUBTITLE_EXTENSIONS = new Set(['srt', 'vtt']);
const RISKY_FORMATS: Partial<Record<string, string>> = {
  mkv: 'MKV', avi: 'AVI', wmv: 'WMV', flv: 'FLV', mpg: 'MPEG', mpeg: 'MPEG',
  hevc: 'H.265', ts: 'MPEG-TS', m2ts: 'MPEG-TS', mts: 'MPEG-TS',
};
const CODEC_HINT =
  'Chrome plays MP4 (H.264/AAC) and WebM (VP8/VP9/AV1) everywhere; MKV, AVI and H.265 depend on your machine.';

interface ErrorMessage {
  title: string;
  message: string;
}

interface DropzoneContent extends ErrorMessage {
  detail?: string;
  error?: boolean;
}

const isSubtitle = (file: File): boolean => SUBTITLE_EXTENSIONS.has(extensionOf(file.name));

/** Checks whether a file:// URL is readable. Resolves true/false, or null if unknown. */
function fileExists(url: string): Promise<boolean | null> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const timer = window.setTimeout(() => {
      xhr.abort();
      resolve(null);
    }, 3000);
    xhr.onreadystatechange = () => {
      if (xhr.readyState >= XMLHttpRequest.HEADERS_RECEIVED) {
        window.clearTimeout(timer);
        resolve(true);
        xhr.abort(); // we only needed to know it opens
      }
    };
    xhr.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    try {
      xhr.open('GET', url);
      xhr.send();
    } catch {
      window.clearTimeout(timer);
      resolve(false);
    }
  });
}

async function hasFileAccess(): Promise<boolean> {
  try {
    return await chrome.extension.isAllowedFileSchemeAccess();
  } catch {
    return true; // API unavailable (page opened outside the extension)
  }
}

async function describeError(code: number, source: VideoSource): Promise<ErrorMessage> {
  switch (code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return {
        title: 'Loading was interrupted',
        message: 'The video stopped loading before it could play. Try opening it again.',
      };
    case MediaError.MEDIA_ERR_NETWORK:
      return source.kind === 'Web link'
        ? {
            title: 'Network error',
            message: 'The connection failed while loading the video. Check your connection or the link, then reload the page.',
          }
        : {
            title: 'The file could not be read',
            message: 'It may have been moved or deleted, or it is on a drive that is no longer connected.',
          };
    case MediaError.MEDIA_ERR_DECODE:
      return {
        title: 'This file seems corrupted',
        message:
          'Chrome started reading the video but could not decode it. The file may be damaged or incomplete (for example, an unfinished download).',
      };
    default: {
      if (source.kind === 'Local file' && (await fileExists(source.url)) === false) {
        return {
          title: 'File not found or inaccessible',
          message:
            'Lumen could not read this file. Check that it still exists, and that "Allow access to file URLs" is enabled for Lumen in chrome://extensions.',
        };
      }
      if (source.kind === 'Web link') {
        return {
          title: "Can't play this link",
          message: `The link may be broken, require a login, refuse to be played from another page, or use a format Chrome can't decode. ${CODEC_HINT}`,
        };
      }
      const format = RISKY_FORMATS[source.ext];
      return {
        title: 'Unsupported format',
        message: `${format ? `${format} files often use codecs Chrome can't decode.` : 'Chrome cannot decode this video.'} ${CODEC_HINT}`,
      };
    }
  }
}

export interface SourceApi {
  openFiles(files: FileList | File[]): void;
  isShowingVideo(): boolean;
}

export function initSource(ctx: PlayerContext, { onSubtitleFile }: { onSubtitleFile: (file: File) => void }): SourceApi {
  const { app, video } = ctx;
  const dropzone = $('#dropzone');
  const dropCard = $('#dropCard');
  const dropTitle = $('#dropTitle');
  const dropMessage = $('#dropMessage');
  const dropDetail = $('#dropDetail');
  const fileInput = $<HTMLInputElement>('#fileInput');
  const dragOverlay = $('#dragOverlay');
  const fileTitle = $('#fileTitle');
  let objectUrl: string | null = null;

  const isShowingVideo = (): boolean => Boolean(ctx.source) && dropzone.hidden === true; // hidden may also be "until-found"

  function showDropzone({ title, message, detail = '', error = false }: DropzoneContent): void {
    dropTitle.textContent = title;
    dropMessage.textContent = message;
    dropDetail.textContent = detail;
    dropDetail.hidden = !detail;
    dropCard.classList.toggle('is-error', error);
    dropzone.hidden = false;
    app.classList.add('show-dropzone');
    if (!video.paused) video.pause();
  }

  function hideDropzone(): void {
    dropzone.hidden = true;
    app.classList.remove('show-dropzone');
  }

  function setSource(source: VideoSource): void {
    if (objectUrl && objectUrl !== source.url) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    ctx.source = source;
    hideDropzone();
    document.title = source.name;
    fileTitle.textContent = source.name;
    fileTitle.title = source.name;
    ctx.emitSourceChange(source);
    video.src = source.url;
    video.play().catch(() => undefined); // autoplay may be refused: the play button stays available
  }

  /** Opens a picked/dropped video file. Returns false if it was rejected. */
  function openVideoFile(file: File): boolean {
    const ext = extensionOf(file.name);
    const looksLikeMedia = /^(video|audio)\//.test(file.type) || VIDEO_EXTENSIONS.has(ext);
    if (!looksLikeMedia) {
      showToast(`"${file.name}" is not a video file`);
      return false;
    }
    const url = URL.createObjectURL(file);
    setSource({
      url,
      name: file.name,
      key: `file:${file.name}:${String(file.size)}`,
      type: file.type || ext.toUpperCase(),
      size: file.size,
      modified: file.lastModified || undefined,
      kind: 'Opened file',
      ext,
    });
    objectUrl = url;
    // The ?src= no longer describes what is playing.
    if (location.search) history.replaceState(null, '', location.pathname);
    return true;
  }

  function openFiles(fileList: FileList | File[]): void {
    const files = [...fileList];
    const videoFile = files.find((f) => !isSubtitle(f));
    const subtitleFile = files.find(isSubtitle);
    const videoOpened = videoFile ? openVideoFile(videoFile) : false;
    if (!subtitleFile) return;
    if (videoOpened || isShowingVideo()) onSubtitleFile(subtitleFile);
    else showToast('Open a video first, then add subtitles');
  }

  async function loadFromParam(src: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(src);
    } catch {
      showDropzone({
        title: 'Invalid link',
        message: 'This address is not a valid video link. Open a file instead.',
        detail: src,
        error: true,
      });
      return;
    }
    if (!['file:', 'http:', 'https:'].includes(url.protocol)) {
      showDropzone({
        title: 'Unsupported link',
        message: 'Lumen only opens local files and direct http(s) links to video files.',
        detail: src,
        error: true,
      });
      return;
    }
    if (url.protocol === 'file:' && !(await hasFileAccess())) {
      location.replace(`${chrome.runtime.getURL(WELCOME_PAGE)}?${SOURCE_PARAM}=${encodeURIComponent(src)}`);
      return;
    }
    const name = fileNameFromUrl(src);
    const ext = extensionOf(name);
    setSource({
      url: src,
      name,
      key: src,
      type: ext.toUpperCase(),
      kind: url.protocol === 'file:' ? 'Local file' : 'Web link',
      ext,
    });
  }

  /* ---------- Errors ---------- */

  async function handleError(): Promise<void> {
    const source = ctx.source;
    const err = video.error;
    if (!source || !err) return;
    const { title, message } = await describeError(err.code, source);
    if (source !== ctx.source) return; // another file was opened meanwhile
    showDropzone({ title, message, detail: err.message ? `Details: ${err.message}` : '', error: true });
  }
  video.addEventListener('error', () => {
    void handleError();
  });

  // Some WebM files (e.g. browser recordings) report an infinite duration.
  // Seeking far past the end makes Chrome compute the real one.
  video.addEventListener('loadedmetadata', () => {
    if (video.duration !== Infinity) return;
    const onDurationChange = (): void => {
      if (!Number.isFinite(video.duration)) return;
      video.removeEventListener('durationchange', onDurationChange);
      video.currentTime = 0;
    };
    video.addEventListener('durationchange', onDurationChange);
    video.currentTime = 1e101;
  });

  // Audio plays but the video track could not be decoded (e.g. H.265 without hardware support).
  video.addEventListener('loadeddata', () => {
    if (ctx.source && !video.videoWidth && !AUDIO_EXTENSIONS.has(ctx.source.ext)) {
      showToast('The video track could not be decoded on this machine: playing audio only', 5000);
    }
  });

  /* ---------- File picker ---------- */

  $('#btnOpenFile').addEventListener('click', () => {
    fileInput.click();
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) openFiles(fileInput.files);
    fileInput.value = '';
  });

  /* ---------- Drag and drop (whole page) ---------- */

  let dragDepth = 0;
  const hasFiles = (event: DragEvent): boolean => Boolean(event.dataTransfer?.types.includes('Files'));

  window.addEventListener('dragenter', (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    dragOverlay.hidden = false;
  });
  window.addEventListener('dragover', (event) => {
    if (!hasFiles(event) || !event.dataTransfer) return;
    event.preventDefault(); // required, otherwise Chrome navigates to the file
    event.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', (event) => {
    if (!hasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dragOverlay.hidden = true;
  });
  window.addEventListener('drop', (event) => {
    if (!hasFiles(event) || !event.dataTransfer) return;
    event.preventDefault();
    dragDepth = 0;
    dragOverlay.hidden = true;
    if (event.dataTransfer.files.length) openFiles(event.dataTransfer.files);
  });

  /* ---------- Start ---------- */

  const src = new URLSearchParams(location.search).get(SOURCE_PARAM);
  if (src) void loadFromParam(src);
  else showDropzone({ title: 'Drop a video here', message: 'or open one from your computer.' });

  return { openFiles, isShowingVideo };
}
