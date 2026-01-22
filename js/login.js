// js/login.js
import { login } from "./auth.js";

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const msg = document.getElementById("msg");

loginBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  if (msg) msg.textContent = "Signing in...";

  const email = (emailEl?.value || "").trim();
  const password = passwordEl?.value || "";

  const res = await login(email, password);

  if (!res?.ok) {
    if (msg) msg.textContent = res?.error || "Login failed.";
    return;
  }

  window.location.href = "./index.html";
});