import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { createDb } from './data-access/db.js';
import { createInMemoryCheckInPort } from './test-support/in-memory-check-in-port.js';
import { createInMemoryAuthPort } from './test-support/in-memory-auth-port.js';
import { createInMemoryStaffPort } from './test-support/in-memory-staff-port.js';

describe('buildApp', () => {
  it('responds to GET /health with 200', async () => {
    const { port } = createInMemoryCheckInPort();
    // Never queried by this test — Pool connections are lazy, so a bogus
    // connection string is fine for a dependency this test doesn't exercise.
    const app = buildApp(
      {
        checkInPort: port,
        authPort: createInMemoryAuthPort().port,
        staffPort: createInMemoryStaffPort().port,
        db: createDb('postgres://unused'),
      },
      { logger: false },
    );
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});
