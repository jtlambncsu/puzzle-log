import { describe, expect, it } from 'vitest';
import { installMethod } from './install';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Mobile Safari/537.36';

const device = (userAgent: string, extra: Partial<Parameters<typeof installMethod>[0]> = {}) =>
  installMethod({ userAgent, maxTouchPoints: 0, standalone: false, canPrompt: false, ...extra });

describe('installMethod', () => {
  it('is installed when opened from the home screen', () => {
    expect(device(IPHONE, { standalone: true })).toBe('installed');
  });

  it('shows the Share-menu steps on iPhones and iPads, even ones that say they are Macs', () => {
    expect(device(IPHONE)).toBe('ios');
    expect(device(IPAD_AS_MAC, { maxTouchPoints: 5 })).toBe('ios');
    expect(device(IPAD_AS_MAC)).toBe('none'); // a real Mac
  });

  it('offers a button only once the browser offers to install', () => {
    expect(device(ANDROID)).toBe('none');
    expect(device(ANDROID, { canPrompt: true })).toBe('prompt');
  });
});
