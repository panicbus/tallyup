import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { createInMemoryCheckInPort } from './test-support/in-memory-check-in-port.js';
import { createInMemoryAuthPort } from './test-support/in-memory-auth-port.js';
import { createInMemoryStaffPort } from './test-support/in-memory-staff-port.js';

describe('buildApp', () => {
  it('responds to GET /health with 200', async () => {
    const { port } = createInMemoryCheckInPort();
    const app = buildApp(
      { checkInPort: port, authPort: createInMemoryAuthPort().port, staffPort: createInMemoryStaffPort().port },
      { logger: false },
    );
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
