// Pure subtitle conversion: decoding, SRT → WebVTT, VTT normalization.

const BOM = String.fromCharCode(0xfeff);

/** Decodes subtitle bytes: UTF-16 (BOM), UTF-8, else Windows-1252 (common for old .srt). */
export function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Removes a leading byte-order mark and converts CRLF / CR line endings to LF. */
export function normalizeNewlines(text: string): string {
  const withoutBom = text.startsWith(BOM) ? text.slice(1) : text;
  return withoutBom.replace(/\r\n?/g, '\n');
}

const TIMESTAMP = /(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})/g;

/** Converts SubRip (.srt) text to WebVTT. */
export function srtToVtt(srt: string): string {
  const body = normalizeNewlines(srt)
    .trim()
    .split('\n')
    .map((line) => {
      if (!line.includes('-->')) return line.replace(/\{\\[^}]*\}/g, ''); // drop {\an8}-style tags
      return line.replace(
        TIMESTAMP,
        (_match, h: string, m: string, s: string, ms: string) =>
          `${h.padStart(2, '0')}:${m.padStart(2, '0')}:${s.padStart(2, '0')}.${ms.padEnd(3, '0')}`,
      );
    })
    .join('\n');
  return `WEBVTT\n\n${body}\n`;
}

/** Ensures a .vtt file starts with the WEBVTT header. */
export function normalizeVtt(text: string): string {
  const clean = normalizeNewlines(text);
  return clean.startsWith('WEBVTT') ? clean : `WEBVTT\n\n${clean}`;
}
