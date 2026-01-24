// js/login.js
import { login, wireAuthButtons, getSession } from "./auth.js";

function getNextUrl() {
  const u = new URL(window.location.href);
  const next = u.searchParams.get("next");

  // Default
  if (!next) return "./index.html";

  // Allow only same-origin relative paths (safe)
  // Accepts: /post.html?id=..., ./post.html?id=..., post.html?id=...
  if (next.startsWith("http://") || next.startsWith("https://")) return "./index.html";
  if (next.startsWith("//")) return "./index.html";

  // If it starts with /, keep it (site-root relative)
  if (next.startsWith("/")) return next;

  // Otherwise treat as relative to current directory
  return next.startsWith("./") || next.startsWith("../") ? next : `./${next}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  await wireAuthButtons({ loginLinkId: "loginLink", logoutBtnId: "logoutBtn" });

  // If user is already logged in, return them immediately
  try {
    const existing = await getSession();
    if (existing) {
      window.location.href = getNextUrl();
      return;
    }
  } catch {
    // ignore session check errors; user can still log in
  }

  const form = document.getElementById("loginForm");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const msgEl = document.getElementById("msg");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (msgEl) msgEl.textContent = "Signing in...";

    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";

    const res = await login(email, password);

    if (!res?.ok) {
      if (msgEl) msgEl.textContent = res?.error || "Login failed.";
      return;
    }

    if (msgEl) msgEl.textContent = "Signed in.";
    window.location.href = getNextUrl();
  });
});