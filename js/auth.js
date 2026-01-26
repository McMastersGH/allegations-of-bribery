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

export async function logout() {
  const sb = getSupabaseClient();
  const { error } = await sb.auth.signOut();
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Show/hide Login/Register vs Logout + show logged-in user badge.
 * Expects IDs (defaults match your index.html):
 * - loginLink
 * - registerLink
 * - logoutBtn
 * - userBadge
 * - userMenuBtn
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

  // If the page doesn't have any auth UI, do nothing.
  if (!loginLink && !registerLink && !logoutBtn && !userBadge && !userMenuBtn) return;

  let session = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }

  if (!session) {
    // Logged out
    if (loginLink) loginLink.style.display = "inline-flex";
    if (registerLink) registerLink.style.display = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (userBadge) userBadge.style.display = "none";
    return;
  }

  // Logged in
  if (loginLink) loginLink.style.display = "none";
  if (registerLink) registerLink.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-flex";
  if (userBadge) userBadge.style.display = "inline-flex";

  // Display name preference: user_metadata.display_name → email
  const user = session.user;
  const display =
    (user?.user_metadata && (user.user_metadata.display_name || user.user_metadata.full_name)) ||
    user?.email ||
    "Account";

  if (userMenuBtn) {
    userMenuBtn.textContent = display;
    userMenuBtn.title = user?.email || display;
  }

  // Wire Logout once
  if (logoutBtn && !logoutBtn.dataset.wired) {
    logoutBtn.dataset.wired = "1";
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await logout();
      window.location.href = logoutRedirect;
    });
  }
}