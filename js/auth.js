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
 * Hard logout for static sites: clear Supabase auth + remove all storage keys for project ref.
 */
export async function logout() {
  const sb = getSupabaseClient();

  // project ref derived from https://ovsshqgcfucwzcgqltes.supabase.co
  const PROJECT_REF = "ovsshqgcfucwzcgqltes";
  const PREFIX = `sb-${PROJECT_REF}-`;

  try {
    const { error } = await sb.auth.signOut({ scope: "local" });
    if (error) console.warn("Supabase signOut error:", error.message);
  } catch (e) {
    console.warn("Supabase signOut threw:", e);
  }

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
 * ✅ REQUIRED BY write.js, post.js, header.js
 * Returns the current user's row from public.authors (if it exists).
 * Resilient to older schemas that might not have is_anonymous.
 */
export async function getMyAuthorStatus() {
  const sb = getSupabaseClient();
  const session = await getSession();
  const uid = session?.user?.id;
  if (!uid) return null;

  // Try with is_anonymous first (newer schema)
  let { data, error } = await sb
    .from("authors")
    .select("user_id, email, display_name, approved, is_anonymous, created_at")
    .eq("user_id", uid)
    .maybeSingle();

  // If column doesn't exist, fall back safely
  if (error && /column .*is_anonymous/i.test(error.message || "")) {
    const fallback = await sb
      .from("authors")
      .select("user_id, email, display_name, approved, created_at")
      .eq("user_id", uid)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
    if (data && typeof data.is_anonymous === "undefined") data.is_anonymous = false;
  }

  if (error) throw error;
  if (data && typeof data.is_anonymous === "undefined") data.is_anonymous = false;
  return data || null;
}

/**
 * ✅ Compatibility export (some pages import getMyProfile)
 * For this site, the profile information is coming from public.authors.
 */
export async function getMyProfile() {
  return await getMyAuthorStatus();
}

/**
 * ✅ REQUIRED BY write.js, post.js
 * Persist account-level anonymity preference (if authors.is_anonymous exists).
 */
export async function setMyAnonymity(isAnonymous) {
  const sb = getSupabaseClient();
  const session = await getSession();
  const uid = session?.user?.id;
  if (!uid) throw new Error("Not signed in.");

  const { error } = await sb
    .from("authors")
    .update({ is_anonymous: Boolean(isAnonymous) })
    .eq("user_id", uid);

  // If schema doesn't support it, fail with a clear message
  if (error && /column .*is_anonymous/i.test(error.message || "")) {
    throw new Error("Anonymity setting is not available (authors.is_anonymous column not found).");
  }
  if (error) throw error;

  return { ok: true };
}

/**
 * Internal: apply logged-in / logged-out UI state.
 */
function applyAuthUI({
  session,
  loginLink,
  registerLink,
  logoutBtn,
  userBadge,
  userMenuBtn,
}) {
  if (!session) {
    if (loginLink) loginLink.style.display = "inline-flex";
    if (registerLink) registerLink.style.display = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (userBadge) userBadge.style.display = "none";
    if (userMenuBtn) userMenuBtn.textContent = "";
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
}

/**
 * Show/hide Login/Register vs Logout + show logged-in user badge
 * ✅ Also listens to auth changes and updates instantly.
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

  const sb = getSupabaseClient();

  if (document.documentElement.dataset.authWired === "1") {
    try {
      const session = await getSession();
      applyAuthUI({ session, loginLink, registerLink, logoutBtn, userBadge, userMenuBtn });
    } catch {
      applyAuthUI({ session: null, loginLink, registerLink, logoutBtn, userBadge, userMenuBtn });
    }
    return;
  }
  document.documentElement.dataset.authWired = "1";

  // Initial render
  try {
    const session = await getSession();
    applyAuthUI({ session, loginLink, registerLink, logoutBtn, userBadge, userMenuBtn });
  } catch {
    applyAuthUI({ session: null, loginLink, registerLink, logoutBtn, userBadge, userMenuBtn });
  }

  // Wire Logout once
  if (logoutBtn && !logoutBtn.dataset.wired) {
    logoutBtn.dataset.wired = "1";
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await logout();
      setTimeout(() => (window.location.href = logoutRedirect), 150);
    });
  }

  // Live updates on auth state changes
  sb.auth.onAuthStateChange((_event, session) => {
    applyAuthUI({ session, loginLink, registerLink, logoutBtn, userBadge, userMenuBtn });
  });
}