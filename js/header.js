// js/header.js
import { getSession, getMyAuthorStatus, logout } from "./auth.js";

/**
 * Header user menu wiring (site-wide)
 *
 * Expected IDs in the page header:
 * - loginLink           (optional)
 * - registerLink        (optional)
 * - userMenuWrap        (required for display name + dropdown)
 * - userMenuBtn         (required)
 * - userMenu            (required)
 * - logoutBtn           (required)
 */
export async function wireHeaderUserMenu({
  loginLinkId = "loginLink",
  registerLinkId = "registerLink",
  userMenuWrapId = "userMenuWrap",
  userMenuBtnId = "userMenuBtn",
  userMenuId = "userMenu",
  logoutBtnId = "logoutBtn",
  logoutRedirect = "./index.html",
} = {}) {
  const loginLink = document.getElementById(loginLinkId);
  const registerLink = document.getElementById(registerLinkId);

  const userMenuWrap = document.getElementById(userMenuWrapId);
  const userMenuBtn = document.getElementById(userMenuBtnId);
  const userMenu = document.getElementById(userMenuId);
  const logoutBtn = document.getElementById(logoutBtnId);

  const hasMenu = Boolean(userMenuWrap && userMenuBtn && userMenu && logoutBtn);

  function setLoggedOutUI() {
    if (loginLink) loginLink.style.display = "inline-flex";
    if (registerLink) registerLink.style.display = "inline-flex";
    if (hasMenu) userMenuWrap.style.display = "none";
  }

  function setLoggedInUI(label) {
    if (loginLink) loginLink.style.display = "none";
    if (registerLink) registerLink.style.display = "none";
    if (hasMenu) userMenuWrap.style.display = "inline-block";
    if (hasMenu) userMenuBtn.textContent = label;
  }

  function closeMenu() {
    if (!hasMenu) return;
    userMenu.style.display = "none";
    userMenuBtn.setAttribute("aria-expanded", "false");
  }

  function toggleMenu() {
    if (!hasMenu) return;
    const open = userMenu.style.display !== "none";
    userMenu.style.display = open ? "none" : "block";
    userMenuBtn.setAttribute("aria-expanded", open ? "false" : "true");
  }

  // Safe defaults
  if (hasMenu) {
    userMenuWrap.style.display = "none";
    userMenu.style.display = "none";
    userMenuBtn.setAttribute("aria-expanded", "false");
  }

  const session = await getSession();
  if (!session) {
    setLoggedOutUI();
    return;
  }

  // Logged in: load label
  let label = "Member";
  try {
    const status = await getMyAuthorStatus(); // { display_name, is_anonymous, ... } or null
    label = status?.is_anonymous ? "Chose Anonymity" : (status?.display_name || "Member");
  } catch {
    // keep fallback
  }

  setLoggedInUI(label);

  if (!hasMenu) return;

  // Wire dropdown
  userMenuBtn.addEventListener("click", (e) => {
    // If the click target was an anchor (account link), allow navigation.
    if (e.target.closest && e.target.closest("a")) return;
    e.preventDefault();
    toggleMenu();
  });

  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    await logout();
    window.location.reload();
  });

  document.addEventListener("click", (e) => {
    if (!userMenuWrap.contains(e.target)) closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}
