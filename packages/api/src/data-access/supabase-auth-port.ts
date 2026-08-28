import { createClient } from '@supabase/supabase-js';
import type { AuthPort } from './auth-port.js';

/** Thin wrapper over Supabase's Auth API — not unit tested directly (same
 * bucket as Kysely's query builder), verified live instead. `getUser`
 * round-trips to Supabase per call rather than verifying the JWT locally,
 * so it stays correct regardless of which signing scheme the project uses. */
export function createSupabaseAuthPort(url: string, anonKey: string): AuthPort {
  const client = createClient(url, anonKey);

  return {
    async verifyToken(token) {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user.email) return null;
      return { userId: data.user.id, email: data.user.email };
    },
  };
}
