import { describe, expect, it } from 'vitest';
import {
  clamp,
  extensionOf,
  fileNameFromUrl,
  formatBytes,
  formatDate,
  formatTime,
  qualityLabel,
  relativeTime,
  safeDecode,
} from '../src/player/format';

describe('formatTime', () => {
  it('formats mm:ss under one hour', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(65.9)).toBe('01:05');
    expect(formatTime(3599)).toBe('59:59');
  });

  it('switches to h:mm:ss from one hour', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3725)).toBe('1:02:05');
    expect(formatTime(36000)).toBe('10:00:00');
  });

  it('can force the hours (so current time matches a long duration)', () => {
    expect(formatTime(65, true)).toBe('0:01:05');
  });

  it('treats invalid values as zero', () => {
    expect(formatTime(Number.NaN)).toBe('00:00');
    expect(formatTime(-10)).toBe('00:00');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('00:00');
  });
});

describe('formatBytes', () => {
  it('uses binary units with one decimal', () => {
    expect(formatBytes(1)).toBe('1 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB');
    expect(formatBytes(2 * 1024 ** 5)).toBe('2048.0 TB');
  });

  it('shows a dash when the size is unknown', () => {
    expect(formatBytes(0)).toBe('—');
    expect(formatBytes(-5)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
  });
});

describe('dates', () => {
  const now = Date.UTC(2026, 10, 23, 12, 0, 0);

  it('formats relative times', () => {
    expect(relativeTime(now - 30_000, now)).toBe('just now');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5 minutes ago');
    expect(relativeTime(now - 86_400_000, now)).toBe('yesterday');
    expect(relativeTime(now - 3 * 86_400_000, now)).toBe('3 days ago');
    expect(relativeTime(now - 2 * 604_800_000, now)).toBe('2 weeks ago');
    expect(relativeTime(now - 400 * 86_400_000, now)).toBe('last year');
    expect(relativeTime(now + 2 * 3_600_000, now)).toBe('in 2 hours');
  });

  it('formats calendar dates in English', () => {
    expect(formatDate(Date.UTC(2026, 10, 20, 12))).toBe('Nov 20, 2026');
  });
});

describe('qualityLabel', () => {
  it('names common resolutions from the shorter side', () => {
    expect(qualityLabel(3840, 2160)).toBe('4K');
    expect(qualityLabel(2560, 1440)).toBe('1440p');
    expect(qualityLabel(1920, 1080)).toBe('1080p');
    expect(qualityLabel(1080, 1920)).toBe('1080p'); // vertical video
    expect(qualityLabel(1280, 720)).toBe('720p');
    expect(qualityLabel(854, 480)).toBe('480p');
    expect(qualityLabel(640, 360)).toBe('360p');
  });
});

describe('file names', () => {
  it('extracts and decodes the last path segment', () => {
    expect(fileNameFromUrl('file:///C:/Videos/My%20Trip.mp4')).toBe('My Trip.mp4');
    expect(fileNameFromUrl('https://x.com/a/b/clip.webm?token=1#t=3')).toBe('clip.webm');
  });

  it('keeps malformed escapes and falls back to "Video"', () => {
    expect(fileNameFromUrl('https://x.com/100%25%zz.mp4')).toBe('100%25%zz.mp4');
    expect(fileNameFromUrl('https://x.com/')).toBe('Video');
    expect(fileNameFromUrl('not a url')).toBe('Video');
  });

  it('reads lower-case extensions', () => {
    expect(extensionOf('Movie.MKV')).toBe('mkv');
    expect(extensionOf('archive.tar.gz')).toBe('gz');
    expect(extensionOf('README')).toBe('');
    expect(extensionOf('trailing.')).toBe('');
  });

  it('safeDecode never throws', () => {
    expect(safeDecode('a%20b')).toBe('a b');
    expect(safeDecode('%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('clamp', () => {
  it('bounds a value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});
