import { describe, expect, it } from 'vitest';
import { isVideoUrl, shouldRedirect, withSource, type NavigationInfo } from '../src/shared/video-url';

const ORIGIN = 'chrome-extension://abcdefghijklmnop/';

describe('isVideoUrl', () => {
  it.each(['mp4', 'm4v', 'webm', 'ogv', 'ogg', 'mov'])('accepts .%s', (ext) => {
    expect(isVideoUrl(`https://example.com/clip.${ext}`)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isVideoUrl('https://example.com/CLIP.MP4')).toBe(true);
    expect(isVideoUrl('file:///C:/Videos/Holiday.WebM')).toBe(true);
  });

  it('ignores the query string and the hash', () => {
    expect(isVideoUrl('https://cdn.example.com/v.mp4?token=abc&x=1')).toBe(true);
    expect(isVideoUrl('https://cdn.example.com/v.mp4#t=30')).toBe(true);
    expect(isVideoUrl('https://example.com/page?file=v.mp4')).toBe(false);
    expect(isVideoUrl('https://example.com/page#v.mp4')).toBe(false);
  });

  it('handles file, http and https only', () => {
    expect(isVideoUrl('file:///home/me/a.mp4')).toBe(true);
    expect(isVideoUrl('http://example.com/a.mp4')).toBe(true);
    expect(isVideoUrl('ftp://example.com/a.mp4')).toBe(false);
    expect(isVideoUrl('data:video/mp4;base64,AAAA')).toBe(false);
    expect(isVideoUrl('blob:https://example.com/1234')).toBe(false);
  });

  it('decodes nothing but handles encoded names', () => {
    expect(isVideoUrl('file:///C:/My%20Videos/trip%201.mp4')).toBe(true);
  });

  it('rejects other extensions and look-alikes', () => {
    expect(isVideoUrl('https://example.com/a.mkv')).toBe(false);
    expect(isVideoUrl('https://example.com/a.mp4.html')).toBe(false);
    expect(isVideoUrl('https://example.com/mp4')).toBe(false);
    expect(isVideoUrl('https://example.com/a.mp4/')).toBe(false);
  });

  it('rejects invalid URLs', () => {
    expect(isVideoUrl('not a url.mp4')).toBe(false);
    expect(isVideoUrl('')).toBe(false);
  });
});

describe('shouldRedirect (service worker guard)', () => {
  const nav = (overrides: Partial<NavigationInfo>): NavigationInfo => ({
    url: 'https://example.com/a.mp4',
    tabId: 3,
    frameId: 0,
    documentLifecycle: 'active',
    ...overrides,
  });

  it('redirects a main-frame navigation to a video file', () => {
    expect(shouldRedirect(nav({}), ORIGIN)).toBe(true);
  });

  it('never redirects Lumen pages (anti-loop), even when ?src= holds a video URL', () => {
    const playerUrl = withSource(`${ORIGIN}player/player.html`, 'https://example.com/a.mp4');
    expect(shouldRedirect(nav({ url: playerUrl }), ORIGIN)).toBe(false);
    expect(shouldRedirect(nav({ url: `${ORIGIN}x/video.mp4` }), ORIGIN)).toBe(false);
  });

  it('ignores sub-frames, non-tab requests and prerenders', () => {
    expect(shouldRedirect(nav({ frameId: 2 }), ORIGIN)).toBe(false);
    expect(shouldRedirect(nav({ tabId: -1 }), ORIGIN)).toBe(false);
    expect(shouldRedirect(nav({ documentLifecycle: 'prerender' }), ORIGIN)).toBe(false);
  });

  it('ignores non-video navigations', () => {
    expect(shouldRedirect(nav({ url: 'https://example.com/' }), ORIGIN)).toBe(false);
  });
});

describe('withSource', () => {
  it('encodes the video URL into ?src=', () => {
    const url = withSource(`${ORIGIN}player/player.html`, 'https://x.com/a b.mp4?q=1&r=2');
    expect(url).toBe(`${ORIGIN}player/player.html?src=https%3A%2F%2Fx.com%2Fa%20b.mp4%3Fq%3D1%26r%3D2`);
    expect(new URL(url).searchParams.get('src')).toBe('https://x.com/a b.mp4?q=1&r=2');
  });
});
