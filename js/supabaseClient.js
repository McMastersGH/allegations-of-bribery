// js/supabaseClient.js
import { createClient } from "https://unpkg.com/@supabase/supabase-js@2/dist/esm/supabase.js";

// Supabase Dashboard → Project Settings → API
export const SUPABASE_URL = "https://ovsshqgcfucwzcgqltes.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_Py3GBxpFjqUm-RMYdOiTXA_1-PAFtRX";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export function getSupabaseClient() {
  return supabase;
}