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

export async function signUp(email, password, displayName, consent = { termsAccepted: false, privacyAccepted: false }) {
  const sb = getSupabaseClient();
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName || "",
          terms_accepted_at: consent?.termsAccepted ? nowIso : null,
          privacy_accepted_at: consent?.privacyAccepted ? nowIso : null
        }
      }
    });
    if (error) return { ok: false, error: error.message };

    // Best-effort: create a profile row (ignore duplicates if trigger already does it).
    const userId = data.user?.id;
    if (userId) {
      const { error: pErr } = await sb.from("authors").insert([{
<<<<<<< HEAD
        user_id: userId,
        display_name: displayName || null,
        terms_accepted_at: consent?.termsAccepted ? nowIso : null,
        privacy_accepted_at: consent?.privacyAccepted ? nowIso : null
=======
  user_id: userId,
  display_name: displayName || null
>>>>>>> origin/main
      }]);

      if (pErr && !String(pErr.message || "").toLowerCase().includes("duplicate")) {
        // Do not fail signup for profile insert issues; surface message as warning.
<<<<<<< HEAD
=======
        // Caller will still proceed.
>>>>>>> origin/main
        console.warn("Profile insert warning:", pErr);
      }
    }

    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function logout() {
  const sb = getSupabaseClient();
  await sb.auth.signOut();
}

export async function requireAuthOrRedirect(redirectTo = "./login.html") {
  const session = await getSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

export async function getMyProfile() {
  const sb = getSupabaseClient();
  const session = await getSession();
  if (!session) return null;

  const { data, error } = await sb
    .from("authors")
    .select("user_id, display_name, approved")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Wires up the header Login/Logout controls used in your HTML.
 * - loginLinkId: <a> element that should be hidden when logged in
 * - logoutBtnId: <button> element that should be shown when logged in
 */
export async function wireAuthButtons({ loginLinkId = "loginLink", logoutBtnId = "logoutBtn" } = {}) {
  const loginLink = document.getElementById(loginLinkId);
  const logoutBtn = document.getElementById(logoutBtnId);

  const session = await getSession();
  const isAuthed = Boolean(session);

  if (loginLink) loginLink.style.display = isAuthed ? "none" : "inline-flex";
  if (logoutBtn) logoutBtn.style.display = isAuthed ? "inline-flex" : "none";

  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await logout();
      window.location.href = "./index.html";
    };
  }
}
