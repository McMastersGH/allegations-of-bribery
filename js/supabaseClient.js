// js/supabaseClient.js
import * as SupabasePkg from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.91.0/+esm";

// Robust import that works whether the CDN exposes createClient as a named export
// or under a default export.
const createClient =
  SupabasePkg.createClient ??
  SupabasePkg.default?.createClient;

if (!createClient) {
  throw new Error("Supabase createClient export not found from CDN module.");
}

// Supabase Dashboard → Project Settings → API
export const SUPABASE_URL = "https://ovsshqgcfucwzcgqltes.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_Py3GBxpFjqUm-RMYdOiTXA_1-PAFtRX";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,

    // IMPORTANT for your static-site email confirmation flow:
    // Avoids PKCE "code verifier not found" issues.
    flowType: "implicit"
  }
});

export function getSupabaseClient() {
  return supabase;
}