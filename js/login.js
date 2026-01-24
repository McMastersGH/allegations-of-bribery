// js/login.js
import { login, getSession } from "./auth.js";

function getNextUrl() {
  const u = new URL(window.location.href);
  const next = u.searchParams.get("next");

  if (!next) return "./index.html";

  // block absolute URLs (open redirect protection)
  if (next.startsWith("http://") || next.startsWith("https://") || next.startsWith("//")) {
    return "./index.html";
  }

  // allow site-root paths like /post.html?id=...
  if (next.startsWith("/")) return next;

  // allow relative paths like post.html?id=... or ./post.html?id=...
  return next.startsWith("./") || next.startsWith("../") ? next : `./${next}`;
}

function setMsg(text) {
  const msgEl = document.getElementById("msg");
  if (msgEl) msgEl.textContent = text || "";
}

async function doLogin() {
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const btn = document.getElementById("loginBtn");

  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  if (!email || !password) {
    setMsg("Enter email and password.");
    return;
  }

  try {
    if (btn) btn.disabled = true;
    setMsg("Signing in...");

    const res = await login(email, password);

    if (!res?.ok) {
      setMsg(res?.error || "Login failed.");
      return;
    }

    setMsg("Signed in.");
    window.location.href = getNextUrl();
  } catch (e) {
    setMsg(`Error: ${e?.message || String(e)}`);
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Hard proof the module loaded:
  console.log("login.js loaded");
  setMsg("Login page ready.");

  // If already logged in, redirect immediately.
  try {
    const existing = await getSession();
    if (existing) {
      window.location.href = getNextUrl();
      return;
    }
  } catch (e) {
    // If session check fails, still allow manual login
    console.warn("getSession failed on login page:", e);
  }

  const form = document.getElementById("loginForm");
  const btn = document.getElementById("loginBtn");

  // Bind submit
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      doLogin();
    });
  }

  // Bind click (extra safety)
  if (btn) {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      doLogin();
    });
  }

  // If neither exists, we want an obvious message.
  if (!form && !btn) {
    setMsg("Login form not found. Check login.html IDs: loginForm, loginBtn, email, password.");
    console.error("Missing loginForm/loginBtn in DOM.");
  }
});