import { describe, expect, it } from 'vitest';
import { decodeText, normalizeNewlines, normalizeVtt, srtToVtt } from '../src/player/subtitle-format';

const BOM = String.fromCharCode(0xfeff);

describe('srtToVtt', () => {
  it('adds the WEBVTT header and converts comma milliseconds to dots', () => {
    const srt = '1\n00:00:01,000 --> 00:00:02,500\nHello\n';
    expect(srtToVtt(srt)).toBe('WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\nHello\n');
  });

  it('strips a leading byte-order mark', () => {
    const vtt = srtToVtt(`${BOM}1\n00:00:01,000 --> 00:00:02,000\nHi`);
    expect(vtt.startsWith('WEBVTT\n\n1\n')).toBe(true);
    expect(vtt).not.toContain(BOM);
  });

  it('normalizes CRLF and lone CR line endings', () => {
    const vtt = srtToVtt('1\r\n00:00:01,000 --> 00:00:02,000\r\nLine one\rLine two\r\n');
    expect(vtt).toBe('WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nLine one\nLine two\n');
    expect(vtt).not.toContain('\r');
  });

  it('accepts cues without an index line', () => {
    const vtt = srtToVtt('00:00:01,000 --> 00:00:02,000\nNo index\n\n00:00:03,000 --> 00:00:04,000\nStill fine');
    expect(vtt).toBe(
      'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nNo index\n\n00:00:03.000 --> 00:00:04.000\nStill fine\n',
    );
  });

  it('keeps overlapping cues as separate cues', () => {
    const srt = '1\n00:00:01,000 --> 00:00:05,000\nFirst\n\n2\n00:00:03,000 --> 00:00:04,000\nSecond';
    const vtt = srtToVtt(srt);
    expect(vtt).toContain('00:00:01.000 --> 00:00:05.000\nFirst');
    expect(vtt).toContain('00:00:03.000 --> 00:00:04.000\nSecond');
  });

  it('pads short hours, minutes, seconds and milliseconds', () => {
    expect(srtToVtt('0:0:1,5 --> 0:00:02,50\nx')).toContain('00:00:01.500 --> 00:00:02.500');
  });

  it('accepts dots instead of commas and long hour counts', () => {
    expect(srtToVtt('100:00:01.000 --> 100:00:02.000\nx')).toContain('100:00:01.000 --> 100:00:02.000');
  });

  it('leaves malformed timestamps untouched instead of guessing', () => {
    const vtt = srtToVtt('1\naa:bb:cc,ddd --> 00:00:02,000\nBroken');
    expect(vtt).toContain('aa:bb:cc,ddd --> 00:00:02.000');
  });

  it('only rewrites timing lines, never the dialogue', () => {
    expect(srtToVtt('1\n00:00:01,000 --> 00:00:02,000\nAt 10:30:15,5')).toContain('\nAt 10:30:15,5\n');
  });

  it('removes ASS-style position tags such as {\\an8}', () => {
    expect(srtToVtt('1\n00:00:01,000 --> 00:00:02,000\n{\\an8}Top text')).toContain('\nTop text\n');
  });

  it('handles an empty file', () => {
    expect(srtToVtt('')).toBe('WEBVTT\n\n\n');
  });
});

describe('normalizeVtt', () => {
  it('keeps a valid header and strips the BOM', () => {
    expect(normalizeVtt(`${BOM}WEBVTT\r\n\r\n00:01.000 --> 00:02.000\r\nHi`)).toBe(
      'WEBVTT\n\n00:01.000 --> 00:02.000\nHi',
    );
  });

  it('adds a missing header', () => {
    expect(normalizeVtt('00:01.000 --> 00:02.000\nHi')).toBe('WEBVTT\n\n00:01.000 --> 00:02.000\nHi');
  });
});

describe('normalizeNewlines', () => {
  it('only removes a BOM at the very start', () => {
    expect(normalizeNewlines(`a${BOM}b`)).toBe(`a${BOM}b`);
  });
});

describe('decodeText', () => {
  const bytes = (...values: number[]): ArrayBuffer => new Uint8Array(values).buffer;

  it('decodes UTF-8', () => {
    expect(decodeText(new TextEncoder().encode('café').buffer)).toBe('café');
  });

  it('falls back to Windows-1252 for invalid UTF-8 (old .srt files)', () => {
    expect(decodeText(bytes(0x63, 0x61, 0x66, 0xe9))).toBe('café');
  });

  it('decodes UTF-16 LE and BE when a BOM is present', () => {
    expect(decodeText(bytes(0xff, 0xfe, 0x48, 0x00, 0x69, 0x00))).toBe('Hi');
    expect(decodeText(bytes(0xfe, 0xff, 0x00, 0x48, 0x00, 0x69))).toBe('Hi');
  });
});
