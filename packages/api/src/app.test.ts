import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { createInMemoryCheckInPort } from './test-support/in-memory-check-in-port.js';

describe('buildApp', () => {
  it('responds to GET /health with 200', async () => {
    const { port } = createInMemoryCheckInPort();
    const app = buildApp({ checkInPort: port }, { logger: false });
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
