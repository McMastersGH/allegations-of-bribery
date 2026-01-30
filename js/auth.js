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
          privacy_accepted_at: consent?.privacyAccepted ? nowIso : null,
        },
      },
    });

    if (error) return { ok: false, error: error.message };

    // Ensure there's an `authors` row for this user so future posts have an
    // `authors.display_name` available. If `data.user.id` is present (it usually
    // is even when email confirmation is required), upsert the authors row.
    try {
      const userId = data?.user?.id;
      if (userId) {
        await sb.from("authors").upsert(
          {
            user_id: userId,
            display_name: displayName || "",
            approved: false,
            is_anonymous: false,
          },
          { onConflict: "user_id" }
        );
      }
    } catch (e) {
      // Non-fatal: signup succeeded but authors upsert failed — ignore.
    }

    const needsEmailConfirm = !data?.session;
    return { ok: true, data, needsEmailConfirm };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ✅ used by signup.html
export async function resendSignupEmail(email) {
  const sb = getSupabaseClient();
  try {
    const { error } = await sb.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/login.html?from=confirm` },
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
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('signedOut'));
    }
  } catch (e) {}
  return { ok: true };
}

// --- Author status helpers (used by write.html / write.js) ---

// Returns the current user's row from public.authors (or null if not present)
export async function getMyProfile() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("authors")
    .select("user_id, display_name, approved, is_anonymous")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

// Returns an object describing the author status used by write gating
export async function getMyAuthorStatus() {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, signed_in: false, approved: false, is_anonymous: false, user_id: null };
  }

  try {
    const p = await getMyProfile();
    return {
      ok: true,
      signed_in: true,
      approved: !!p?.approved,
      is_anonymous: !!p?.is_anonymous,
      user_id: session.user.id,
      display_name:
        p?.display_name ||
        (session.user?.user_metadata && (session.user.user_metadata.display_name || session.user.user_metadata.full_name)) ||
        null,
    };
  } catch (e) {
    return {
      ok: false,
      signed_in: true,
      approved: false,
      is_anonymous: false,
      user_id: session.user.id,
      error: String(e),
    };
  }
}

export async function isApprovedAuthor(userId) {
  const sb = getSupabaseClient();
  const id = userId || (await getSession())?.user?.id;
  if (!id) return false;

  const { data, error } = await sb.from("authors").select("approved").eq("user_id", id).maybeSingle();
  if (error) throw error;
  return !!data?.approved;
}

export async function setMyAnonymity(isAnonymous) {
  const session = await getSession();
  if (!session?.user?.id) return { ok: false, error: "Not signed in." };

  const sb = getSupabaseClient();
  const { error } = await sb
    .from("authors")
    .update({ is_anonymous: !!isAnonymous })
    .eq("user_id", session.user.id);

  if (error) return { ok: false, error: error.message };
  try {
    // Notify other parts of the app about the change so UI can update live
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('anonymityChanged', { detail: { is_anonymous: !!isAnonymous } }));
    }
  } catch (e) {}
  return { ok: true };
}

/**
 * Internal: apply logged-in / logged-out UI state.
 * (Used both on initial load and onAuthStateChange.)
 */
function applyAuthUI({ session, loginLink, registerLink, logoutBtn, userBadge, userMenuBtn }) {
  if (!session) {
    // Logged out
    if (loginLink) loginLink.style.display = "inline-flex";
    if (registerLink) registerLink.style.display = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (userBadge) userBadge.style.display = "none";
    if (userMenuBtn) userMenuBtn.textContent = "";
    return;
  }

  // Logged in
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
    // Render the display name as a link to the account page while preserving
    // the surrounding element so existing dropdown wiring works.
    // Create an anchor and insert it as the only child to avoid HTML-escaping issues.
    userMenuBtn.innerHTML = "";
    const a = document.createElement("a");
    a.href = "./account.html";
    a.textContent = display;
    a.style.color = "inherit";
    a.style.textDecoration = "none";
    a.title = user?.email || display;
    userMenuBtn.appendChild(a);
  }
}

/**
 * Show/hide Login/Register vs Logout + show logged-in user badge
 * ✅ Now also listens to auth changes and updates instantly.
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

  // Initial paint
  let session = null;
  try {
    session = await getSession();
  } catch {
    session = null;
  }
  applyAuthUI({ session, loginLink, registerLink, logoutBtn, userBadge, userMenuBtn });

  // Wire logout once
  if (logoutBtn && !logoutBtn.dataset.wired) {
    logoutBtn.dataset.wired = "1";
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await logout();
      window.location.href = logoutRedirect;
    });
  }

  // Live updates on auth changes
  try {
    const sb = getSupabaseClient();
    sb.auth.onAuthStateChange((_event, newSession) => {
      applyAuthUI({ session: newSession, loginLink, registerLink, logoutBtn, userBadge, userMenuBtn });
    });
  } catch {
    // ignore
  }
}