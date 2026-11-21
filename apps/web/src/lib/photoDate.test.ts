import { describe, expect, it } from 'vitest';
import { parseExifDate, readPhotoDate } from './photoDate';

describe('parseExifDate', () => {
  it('takes the date part of an EXIF timestamp', () => {
    expect(parseExifDate('2026:11:14 18:32:10')).toBe('2026-11-14');
  });

  it.each([undefined, '', '0000:00:00 00:00:00', 'November 14', '2026-11-14'])(
    'ignores %j',
    (value) => {
      expect(parseExifDate(value)).toBeUndefined();
    },
  );
});

describe('readPhotoDate', () => {
  it('returns undefined for files without EXIF', async () => {
    expect(await readPhotoDate(new Blob(['not an image']))).toBeUndefined();
  });
});
