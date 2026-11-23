import { describe, expect, it } from 'vitest';
import { CODEC_HINT, errorCategory, errorMessage, MEDIA_ERR, needsExistenceCheck } from '../src/player/errors';

describe('errorCategory', () => {
  it('maps aborted loads', () => {
    expect(errorCategory(MEDIA_ERR.ABORTED, 'Local file')).toBe('aborted');
  });

  it('maps network errors: network for web links, unreadable for files', () => {
    expect(errorCategory(MEDIA_ERR.NETWORK, 'Web link')).toBe('network');
    expect(errorCategory(MEDIA_ERR.NETWORK, 'Local file')).toBe('unreadable');
    expect(errorCategory(MEDIA_ERR.NETWORK, 'Opened file')).toBe('unreadable');
  });

  it('maps decode errors to corrupted', () => {
    expect(errorCategory(MEDIA_ERR.DECODE, 'Opened file')).toBe('corrupted');
  });

  it('maps unsupported local files to missing only when the file is really gone', () => {
    expect(errorCategory(MEDIA_ERR.SRC_NOT_SUPPORTED, 'Local file', false)).toBe('missing');
    expect(errorCategory(MEDIA_ERR.SRC_NOT_SUPPORTED, 'Local file', true)).toBe('unsupported');
    expect(errorCategory(MEDIA_ERR.SRC_NOT_SUPPORTED, 'Local file', null)).toBe('unsupported');
  });

  it('maps unsupported web links and opened files', () => {
    expect(errorCategory(MEDIA_ERR.SRC_NOT_SUPPORTED, 'Web link')).toBe('link');
    expect(errorCategory(MEDIA_ERR.SRC_NOT_SUPPORTED, 'Opened file')).toBe('unsupported');
  });

  it('only checks existence for unsupported local files', () => {
    expect(needsExistenceCheck(MEDIA_ERR.SRC_NOT_SUPPORTED, 'Local file')).toBe(true);
    expect(needsExistenceCheck(MEDIA_ERR.DECODE, 'Local file')).toBe(false);
    expect(needsExistenceCheck(MEDIA_ERR.SRC_NOT_SUPPORTED, 'Web link')).toBe(false);
  });
});

describe('errorMessage', () => {
  it('names risky containers in the unsupported message', () => {
    const { title, message } = errorMessage('unsupported', 'mkv');
    expect(title).toBe('Unsupported format');
    expect(message).toContain("MKV files often use codecs Chrome can't decode.");
    expect(message).toContain(CODEC_HINT);
    expect(errorMessage('unsupported', 'hevc').message).toContain('H.265 files');
  });

  it('uses a generic message for other formats', () => {
    expect(errorMessage('unsupported', 'mp4').message).toMatch(/^Chrome cannot decode this video\./);
  });

  it('has a distinct title for every category', () => {
    const categories = ['aborted', 'network', 'unreadable', 'corrupted', 'missing', 'link', 'unsupported'] as const;
    const titles = categories.map((c) => errorMessage(c, '').title);
    expect(new Set(titles).size).toBe(categories.length);
    expect(errorMessage('missing', '').message).toContain('Allow access to file URLs');
  });
});
