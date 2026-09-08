import { createClient } from '@supabase/supabase-js';

// Captured before createClient() below can consume and strip the URL hash.
// A Supabase password-reset link lands here as `#...type=recovery`; a normal
// visit (or an already-signed-in user opening /reset-password by hand) does
// not, which is how ResetPassword tells a real reset apart from neither.
const initialHash = typeof window !== 'undefined' ? window.location.hash : '';
export const arrivedViaPasswordRecovery = /(?:^|[#&])type=recovery(?:&|$)/.test(initialHash);

export const supabaseClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
