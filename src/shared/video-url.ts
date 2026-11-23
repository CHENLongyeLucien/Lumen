// Pure redirect logic used by the service worker.

import { SOURCE_PARAM } from './types';

/** Direct video files Lumen opens (case-insensitive, query and hash ignored). */
export const VIDEO_EXTENSIONS = /\.(mp4|m4v|webm|ogv|ogg|mov)$/i;
const HANDLED_PROTOCOLS = new Set(['file:', 'http:', 'https:']);

/** True when the URL points directly to a video file we can handle. */
export function isVideoUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  // URL.pathname already excludes ?query and #hash.
  return HANDLED_PROTOCOLS.has(url.protocol) && VIDEO_EXTENSIONS.test(url.pathname);
}

/** The subset of webNavigation details the redirect decision depends on. */
export interface NavigationInfo {
  url: string;
  tabId: number;
  frameId: number;
  documentLifecycle?: string;
}

/**
 * Whether a navigation should be redirected to Lumen.
 * Only main frames of real tabs, never prerenders, and never Lumen's own pages
 * (the anti-loop guard: the player URL itself carries the video URL in ?src=).
 */
export function shouldRedirect(nav: NavigationInfo, extensionOrigin: string): boolean {
  if (nav.frameId !== 0 || nav.tabId < 0) return false;
  if (nav.documentLifecycle === 'prerender') return false;
  if (nav.url.startsWith(extensionOrigin)) return false;
  return isVideoUrl(nav.url);
}

/** Builds `<page>?src=<encoded video URL>`. */
export const withSource = (pageUrl: string, videoUrl: string): string =>
  `${pageUrl}?${SOURCE_PARAM}=${encodeURIComponent(videoUrl)}`;
