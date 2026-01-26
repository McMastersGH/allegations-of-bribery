// js/auth.js
import { getSupabaseClient } from "./supabaseClient.js";

export async function getSession() {
  const sb = getSupabaseClient();
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function getUser() {
  const sb = getSupabaseClient();
  const { data, error } = await sb.auth.getUser();
  if (error) throw error;
  return data.user || null;
}

export async function login(email, password) {
  const sb = getSupabaseClient();
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function signUp(
  email,
  password,
  displayName,
  consent = { termsAccepted: false, privacyAccepted: false }
) {
  const sb = getSupabaseClient();
  try {
    const nowIso = new Date().toISOString();

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        // Marker helps login page show a friendly message
        emailRedirectTo: `${window.location.origin}/login.html?from=confirm`,
        data: {
          display_name: displayName || "",
          terms_accepted_at: consent?.termsAccepted ? nowIso : null,
          privacy_accepted_at: consent?.privacyAccepted ? nowIso : null
        }
      }
    });

    if (error) return { ok: false, error: error.message };

    const needsEmailConfirm = !data?.session;
    return { ok: true, data, needsEmailConfirm };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ✅ Add missing export used by signup.html
export async function resendSignupEmail(email) {
  const sb = getSupabaseClient();
  try {
    const { error } = await sb.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/login.html?from=confirm` }
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function logout() {
  const sb = getSupabaseClient();
  const { error } = await sb.auth.signOut();
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}