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
    window.location.href = "./index.html";
  } catch (err) {
    // IMPORTANT: this catches the NetworkError and shows it instead of silently redirecting
    setMsg(`Login exception: ${err?.message || String(err)}`);
    console.error("Login exception:", err);
  }
});