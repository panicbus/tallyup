import { describe, expect, it } from 'vitest';
import { slugify } from './slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Demo Bookstore')).toBe('demo-bookstore');
  });

  it('strips punctuation', () => {
    expect(slugify("Sal's Coffee & Tea!")).toBe('sals-coffee-tea');
  });

  it('collapses repeated separators into one hyphen', () => {
    expect(slugify('Foo   ---  Bar')).toBe('foo-bar');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -Foo Bar-  ')).toBe('foo-bar');
  });
});
