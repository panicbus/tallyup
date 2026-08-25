import { describe, expect, it } from 'vitest';

describe('shared harness', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
