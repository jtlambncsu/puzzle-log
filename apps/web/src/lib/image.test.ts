import { describe, expect, it } from 'vitest';
import { compressImage, nextRotation, rotatedSize } from './image';

describe('rotation helpers', () => {
  it('cycles through quarter turns', () => {
    expect([0, 90, 180, 270].map((r) => nextRotation(r as 0))).toEqual([90, 180, 270, 0]);
  });

  it('swaps width and height for quarter turns', () => {
    expect(rotatedSize(400, 300, 0)).toEqual({ width: 400, height: 300 });
    expect(rotatedSize(400, 300, 90)).toEqual({ width: 300, height: 400 });
    expect(rotatedSize(400, 300, 180)).toEqual({ width: 400, height: 300 });
    expect(rotatedSize(400, 300, 270)).toEqual({ width: 300, height: 400 });
  });
});

describe('compressImage without canvas support (jsdom)', () => {
  const photo = new Blob(['bytes'], { type: 'image/jpeg' });

  it('returns the original when not rotating', async () => {
    expect(await compressImage(photo)).toBe(photo);
  });

  it('refuses to silently skip a rotation', async () => {
    await expect(compressImage(photo, { rotation: 90 })).rejects.toThrow("Couldn't rotate");
  });
});
