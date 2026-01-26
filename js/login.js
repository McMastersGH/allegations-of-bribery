// js/login.js
import { login, getSession } from "./auth.js";
import { supabase } from "./supabaseClient.js";

function getNextUrl() {
  const u = new URL(window.location.href);
  const next = u.searchParams.get("next");

  // Default
  if (!next) return "./index.html";

  // Block absolute / protocol-relative URLs (open-redirect protection)
  if (next.startsWith("http://") || next.startsWith("https://") || next.startsWith("//")) {
    return "./index.html";
  }

  // Allow site-root relative: /post.html?id=...
  if (next.startsWith("/")) return next;

  // Allow simple relative: post.html?id=...  or ./post.html?id=...
  return next.startsWith("./") || next.startsWith("../") ? next : `./${next}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("loginForm");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const msgEl = document.getElementById("msg");
  const loginBtn = document.getElementById("loginBtn");

  const url = new URL(window.location.href);
  const fromConfirm = url.searchParams.get("from") === "confirm";

  // 1) Handle PKCE email links: login.html?code=...
  // (You should stop seeing these after flowType: "implicit", but leaving this is safe.)
  try {
    const code = url.searchParams.get("code");
    if (code) {
      if (msgEl) msgEl.textContent = "Finishing sign-in from email link...";

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        if (msgEl) msgEl.textContent = `Email confirmation failed: ${error.message}`;
        return;
      }

      if (msgEl) msgEl.textContent = "Email confirmed. Signing you in...";

      url.searchParams.delete("code");
      url.searchParams.delete("type");
      url.searchParams.delete("from");
      history.replaceState(null, "", url.pathname);

      // Force paint, then redirect after a short pause
      await new Promise(requestAnimationFrame);
      setTimeout(() => (window.location.href = getNextUrl()), 1500);
      return;
    }
  } catch (e) {
    console.error("PKCE exchange failed", e);
  }

  // 2) If already signed in, redirect (but show confirm message when coming from email)
  try {
    const existing = await getSession();
    if (existing) {
      if (msgEl) {
        msgEl.textContent = fromConfirm
          ? "Email confirmed. Signing you in..."
          : "You are already signed in. Redirecting...";
      }

      // Clean the marker so refresh doesn't keep showing the message
      if (fromConfirm) {
        url.searchParams.delete("from");
        history.replaceState(
          null,
          "",
          url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "")
        );
      }

      // Force paint, then redirect
      await new Promise(requestAnimationFrame);
      setTimeout(() => (window.location.href = getNextUrl()), fromConfirm ? 1500 : 200);
      return;
    }
  } catch {
    // ignore
  }

  if (!form) {
    if (msgEl) msgEl.textContent = "Login form not found (missing #loginForm).";
    return;
  }

  // 3) Normal password login
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (loginBtn) loginBtn.disabled = true;
    if (msgEl) msgEl.textContent = "Signing in...";

    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";

    const res = await login(email, password);

    if (!res?.ok) {
      if (msgEl) msgEl.textContent = res?.error || "Login failed.";
      if (loginBtn) loginBtn.disabled = false;
      return;
    }

    if (msgEl) msgEl.textContent = "Signed in.";
    window.location.href = getNextUrl();
  });
});