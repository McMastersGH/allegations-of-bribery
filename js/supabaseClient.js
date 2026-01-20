import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/*
  Supabase client configuration
  --------------------------------
  Replace the values below with your actual Supabase project values.

  Supabase Dashboard →
  Project Settings →
  API →
  Project URL
  anon public key
*/

const SUPABASE_URL = "https://ovsshqgcfucwzcgqltes.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Py3GBxpFjqUm-RMYdOiTXA_1-PAFtRX";

/*
  Create and export a single Supabase client instance
  This client is shared across all modules
*/
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

/*
  Optional helper for debugging (safe to remove later)
*/
export function getSupabaseClient() {
  return supabase;
}
