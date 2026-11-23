import { describe, expect, it } from 'vitest';
import { parseAppearance, resolveTheme } from '../src/shared/appearance-state';
import { parseDirectoryListing, splitFileUrl } from '../src/player/file-stat';

describe('parseDirectoryListing', () => {
  // Same shape as the page Chrome renders for file:///folder/
  const html = [
    '<script>start("C:\\\\Videos\\\\");</script>',
    '<script>addRow("..","..",1,0,"0 B",0,"");</script>',
    '<script>addRow("Holiday trip.mp4","Holiday%20trip.mp4",0,10485760,"10.0 MB",1763856000,"11/23/25, 12:00:00 AM");</script>',
    '<script>addRow("Café \\"best\\".webm","Caf%C3%A9%20%22best%22.webm",0,2048,"2.0 kB",1700000000,"11/14/23");</script>',
  ].join('\n');

  it('finds a file by its decoded name', () => {
    expect(parseDirectoryListing(html, 'Holiday trip.mp4')).toEqual({
      size: 10485760,
      modified: 1763856000000,
    });
  });

  it('handles escaped quotes and non-ASCII names', () => {
    expect(parseDirectoryListing(html, 'Café "best".webm')).toEqual({ size: 2048, modified: 1700000000000 });
  });

  it('returns null when the file is not listed or the page is not a listing', () => {
    expect(parseDirectoryListing(html, 'missing.mp4')).toBeNull();
    expect(parseDirectoryListing('<html>Not found</html>', 'Holiday trip.mp4')).toBeNull();
  });

  it('splits a file URL into folder and decoded name', () => {
    expect(splitFileUrl('file:///C:/Videos/Holiday%20trip.mp4')).toEqual({
      folderUrl: 'file:///C:/Videos/',
      fileName: 'Holiday trip.mp4',
    });
  });
});

describe('appearance', () => {
  it('parses saved values and falls back field by field', () => {
    expect(parseAppearance('{"theme":"light","accent":"blue"}')).toEqual({ theme: 'light', accent: 'blue' });
    expect(parseAppearance('{"theme":"neon","accent":"blue"}')).toEqual({ theme: 'dark', accent: 'blue' });
    expect(parseAppearance('{"theme":"system","accent":"gold"}')).toEqual({
      theme: 'system',
      accent: 'amber',
    });
  });

  it('returns defaults for missing or corrupt data', () => {
    expect(parseAppearance(null)).toEqual({ theme: 'dark', accent: 'amber' });
    expect(parseAppearance('{oops')).toEqual({ theme: 'dark', accent: 'amber' });
    expect(parseAppearance('[1,2]')).toEqual({ theme: 'dark', accent: 'amber' });
  });

  it('resolves "system" from the OS preference', () => {
    expect(resolveTheme('system', true)).toBe('light');
    expect(resolveTheme('system', false)).toBe('dark');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', true)).toBe('dark');
  });
});
