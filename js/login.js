// js/login.js
import { login, getSession } from "./auth.js";

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

  // If already logged in, bounce to next immediately
  try {
    const existing = await getSession();
    if (existing) {
      window.location.href = getNextUrl();
      return;
    }
  } catch {
    // ignore
  }

  if (!form) {
    if (msgEl) msgEl.textContent = "Login form not found (missing #loginForm).";
    return;
  }

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