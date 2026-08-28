import { randomUUID } from 'node:crypto';
import type { AuthIdentity, AuthPort } from '../data-access/auth-port.js';

export function createInMemoryAuthPort() {
  const tokensByIdentity = new Map<string, AuthIdentity>();

  return {
    port: {
      async verifyToken(token: string): Promise<AuthIdentity | null> {
        return tokensByIdentity.get(token) ?? null;
      },
    } satisfies AuthPort,

    /** Mints an opaque token standing in for a real Supabase-issued JWT. */
    issueToken(identity: AuthIdentity = { userId: randomUUID(), email: 'staff@example.com' }): string {
      const token = `test-token-${randomUUID()}`;
      tokensByIdentity.set(token, identity);
      return token;
    },
  };
}
