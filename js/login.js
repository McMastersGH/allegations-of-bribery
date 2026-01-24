// js/login.js
// js/login.js
import { login } from "./auth.js";

const form = document.getElementById("loginForm");
const emailEl = document.getElementById("email");
const passEl = document.getElementById("password");
const msgEl = document.getElementById("msg"); // if you don't have one, add <p id="msg"></p> in login.html

function setMsg(text) {
  if (msgEl) msgEl.textContent = text;
}

// js/login.js
import { login, wireAuthButtons, getSession } from "./auth.js";

function getNextUrl() {
  const u = new URL(window.location.href);
  const next = u.searchParams.get("next");

  // If next is missing, default to home
  if (!next) return "./index.html";

  // Security: only allow same-origin relative paths
  // (prevents someone passing https://evil.com)
  if (next.startsWith("/") || next.startsWith("./") || next.startsWith("../")) return next;

  // If it's something weird, ignore it
  return "./index.html";
}

document.addEventListener("DOMContentLoaded", async () => {
  await wireAuthButtons({ loginLinkId: "loginLink", logoutBtnId: "logoutBtn" });

  // If already logged in, go back immediately
  const existing = await getSession();
  if (existing) {
    window.location.href = getNextUrl();
    return;
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
    if (!res.ok) {
      if (msgEl) msgEl.textContent = res.error || "Login failed.";
      return;
    }

    if (msgEl) msgEl.textContent = "Signed in.";
    window.location.href = getNextUrl();
  });
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("Signing in...");

  try {
    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";

    const res = await login(email, password);

    if (!res?.ok) {
      setMsg(`Login failed: ${res?.error || "Unknown error"}`);
      console.error("Login failed result:", res);
      return; // IMPORTANT: do NOT redirect on failure
    }

    setMsg("Login successful. Redirecting...");
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next || "./index.html";

  } catch (err) {
    // IMPORTANT: this catches the NetworkError and shows it instead of silently redirecting
    setMsg(`Login exception: ${err?.message || String(err)}`);
    console.error("Login exception:", err);
  }
});