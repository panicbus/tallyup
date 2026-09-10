import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// This project doesn't run Vitest with `globals: true`, so
// @testing-library/react's automatic afterEach(cleanup) never registers
// (it only hooks in when a global `afterEach` exists). Without this, each
// test's render is left mounted in the shared jsdom document and the next
// test in the same file sees duplicate elements.
afterEach(() => {
  cleanup();
});
