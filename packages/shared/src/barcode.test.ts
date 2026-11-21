import { describe, expect, it } from 'vitest';
import { normalizeBarcode } from './barcode.js';

describe('normalizeBarcode', () => {
  it('turns 12-digit UPC-A into 13-digit EAN-13', () => {
    expect(normalizeBarcode('021081311144')).toBe('0021081311144');
    expect(normalizeBarcode('0021081311144')).toBe('0021081311144');
  });

  it('ignores spaces and dashes from typing', () => {
    expect(normalizeBarcode('0 79346 12567 8')).toBe('0079346125678');
  });

  it('accepts EAN-13 and EAN-8', () => {
    expect(normalizeBarcode('4005556173679')).toBe('4005556173679'); // a Ravensburger EAN
    expect(normalizeBarcode('96385074')).toBe('96385074');
  });

  it.each(['021081311145', '12345', 'abc', '', '00210813111440'])('rejects %j', (code) => {
    expect(normalizeBarcode(code)).toBeUndefined();
  });
});
