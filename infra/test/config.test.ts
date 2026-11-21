import { describe, expect, it } from 'vitest';
import { listSetting } from '../lib/config.js';

describe('listSetting', () => {
  it('splits and trims a comma-separated value', () => {
    expect(listSetting(' https://a.example , https://b.example ')).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });

  it('falls through blank values, like an unset GitHub variable', () => {
    expect(listSetting(undefined, '', '  ', 'https://default.example')).toEqual([
      'https://default.example',
    ]);
  });

  it('returns undefined when nothing is set', () => {
    expect(listSetting(undefined, '')).toBeUndefined();
  });
});
