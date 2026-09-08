import { describe, expect, it } from 'vitest';
import { toCsv } from './csv.js';

describe('toCsv', () => {
  it('joins fields with commas and rows with CRLF, per RFC 4180', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });

  it('leaves a plain field unquoted', () => {
    expect(toCsv([['plain', '123']])).toBe('plain,123');
  });

  it('quotes a field containing a comma', () => {
    expect(toCsv([['a,b', 'c']])).toBe('"a,b",c');
  });

  it('quotes and doubles an embedded double quote', () => {
    expect(toCsv([['say "hi"', 'x']])).toBe('"say ""hi""",x');
  });

  it('quotes a field containing a newline', () => {
    expect(toCsv([['line1\nline2', 'x']])).toBe('"line1\nline2",x');
  });
});
