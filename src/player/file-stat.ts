// Pure parsing of the file date and size from Chrome's directory listing page.

import { safeDecode } from './format';

export interface FileStat {
  size?: number;
  modified?: number; // ms
}

/** Matches addRow("name","url",isDir,size,"size text",modifiedSeconds, ...) lines. */
const ROW = /addRow\(("(?:[^"\\]|\\.)*"),("(?:[^"\\]|\\.)*"),(\d+),(\d+),"(?:[^"\\]|\\.)*",(\d+),/g;

/**
 * Finds `fileName` (decoded, as in the last segment of its file:// URL) in the
 * HTML Chrome generates for file:///folder/, and returns its size and date.
 */
export function parseDirectoryListing(html: string, fileName: string): FileStat | null {
  for (const match of html.matchAll(ROW)) {
    try {
      const name: unknown = JSON.parse(match[1] ?? '""');
      const url: unknown = JSON.parse(match[2] ?? '""');
      if (name === fileName || (typeof url === 'string' && safeDecode(url) === fileName)) {
        return { size: Number(match[4]) || undefined, modified: Number(match[5]) * 1000 || undefined };
      }
    } catch {
      /* malformed row: skip */
    }
  }
  return null;
}

/** Splits a file:// URL into its folder URL and decoded file name. */
export function splitFileUrl(fileUrl: string): { folderUrl: string; fileName: string } {
  const slash = fileUrl.lastIndexOf('/');
  return { folderUrl: fileUrl.slice(0, slash + 1), fileName: safeDecode(fileUrl.slice(slash + 1)) };
}
