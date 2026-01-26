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

// Used by signup.html
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

/**
 * ✅ FIX: hard logout for static sites
 * Clears Supabase auth session + removes ALL storage keys for this project ref.
 */
export async function logout() {
  const sb = getSupabaseClient();

  // project ref derived from https://ovsshqgcfucwzcgqltes.supabase.co
  const PROJECT_REF = "ovsshqgcfucwzcgqltes";
  const PREFIX = `sb-${PROJECT_REF}-`;

  // 1) Ask Supabase to sign out (local session)
  try {
    const { error } = await sb.auth.signOut({ scope: "local" });
    if (error) console.warn("Supabase signOut error:", error.message);
  } catch (e) {
    console.warn("Supabase signOut threw:", e);
  }

  // 2) Hard clear any persisted tokens/verifiers for this project
  const clearStore = (store) => {
    try {
      const keys = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.startsWith(PREFIX)) keys.push(k);
      }
      keys.forEach((k) => store.removeItem(k));
    } catch {}
  };

  clearStore(localStorage);
  clearStore(sessionStorage);

  return { ok: true };
}

/**
 * Show/hide Login/Register vs Logout + show logged-in user badge
 */
export async function wireAuthButtons({
  loginLinkId = "loginLink",
  registerLinkId = "registerLink",
  logoutBtnId = "logoutBtn",
  userBadgeId = "userBadge",
  userMenuBtnId = "userMenuBtn",
  logoutRedirect = "./index.html",
} = {}) {
  const loginLink = document.getElementById(loginLinkId);
  const registerLink = document.getElementById(registerLinkId);
  const logoutBtn = document.getElementById(logoutBtnId);
  const userBadge = document.getElementById(userBadgeId);
  const userMenuBtn = document.getElementById(userMenuBtnId);

  if (!loginLink && !registerLink && !logoutBtn && !userBadge && !userMenuBtn) return;

  let session = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }

  if (!session) {
    if (loginLink) loginLink.style.display = "inline-flex";
    if (registerLink) registerLink.style.display = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (userBadge) userBadge.style.display = "none";
    return;
  }

  if (loginLink) loginLink.style.display = "none";
  if (registerLink) registerLink.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-flex";
  if (userBadge) userBadge.style.display = "inline-flex";

  const user = session.user;
  const display =
    (user?.user_metadata && (user.user_metadata.display_name || user.user_metadata.full_name)) ||
    user?.email ||
    "Account";

  if (userMenuBtn) {
    userMenuBtn.textContent = display;
    userMenuBtn.title = user?.email || display;
  }

  if (logoutBtn && !logoutBtn.dataset.wired) {
    logoutBtn.dataset.wired = "1";
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await logout();

      // small delay helps ensure storage clears before redirect
      setTimeout(() => {
        window.location.href = logoutRedirect;
      }, 150);
    });
  }
}