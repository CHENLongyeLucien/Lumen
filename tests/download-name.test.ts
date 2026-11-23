import { describe, expect, it } from 'vitest';
import { downloadFileName, downloadProgress, pathToFileUrl } from '../src/player/download-name';

describe('downloadFileName', () => {
  it('uses the decoded last path segment', () => {
    expect(downloadFileName('https://cdn.example.com/media/My%20Trip.mp4?sig=abc#t=4')).toBe('My Trip.mp4');
  });

  it('replaces characters that are not allowed in file names', () => {
    expect(downloadFileName('https://x.com/a%3Ab%3Fc%22d%7Ce.webm')).toBe('a_b_c_d_e.webm');
  });

  it('trims leading/trailing dots and spaces', () => {
    expect(downloadFileName('https://x.com/..%20clip.mp4%20.')).toBe('clip.mp4');
  });

  it('keeps the end (extension) of very long names', () => {
    const name = downloadFileName(`https://x.com/${'a'.repeat(300)}.mp4`);
    expect(name).toHaveLength(180);
    expect(name?.endsWith('.mp4')).toBe(true);
  });

  it('lets Chrome choose when the URL has no usable name', () => {
    expect(downloadFileName('https://x.com/')).toBeUndefined();
    expect(downloadFileName('not a url')).toBeUndefined();
    expect(downloadFileName('https://x.com/%3F%3F%3F')).toBeUndefined();
  });
});

describe('pathToFileUrl', () => {
  it('converts Windows paths', () => {
    expect(pathToFileUrl('C:\\Users\\me\\Downloads\\My Trip.mp4')).toBe(
      'file:///C:/Users/me/Downloads/My%20Trip.mp4',
    );
  });

  it('converts POSIX paths', () => {
    expect(pathToFileUrl('/home/me/Downloads/clip #1.webm')).toBe(
      'file:///home/me/Downloads/clip%20%231.webm',
    );
  });

  it('round-trips through the URL parser', () => {
    const url = new URL(pathToFileUrl('D:\\Vidéos\\été 2026.mp4'));
    expect(url.protocol).toBe('file:');
    expect(decodeURIComponent(url.pathname)).toBe('/D:/Vidéos/été 2026.mp4');
  });
});

describe('downloadProgress', () => {
  it('shows a percentage when the size is known', () => {
    expect(downloadProgress(0, 200)).toBe('0%');
    expect(downloadProgress(84, 200)).toBe('42%');
    expect(downloadProgress(250, 200)).toBe('100%');
  });

  it('shows megabytes when the size is unknown', () => {
    expect(downloadProgress(0, 0)).toBe('');
    expect(downloadProgress(1.5 * 1024 * 1024, 0)).toBe('1.5 MB');
    expect(downloadProgress(25 * 1024 * 1024, -1)).toBe('25 MB');
  });
});
