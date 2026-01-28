// js/shell.js
import { wireAuthButtons } from "./auth.js";

export default async function initShell() {
  // Inject header
  const headerHtml = `
  <header class="sticky top-0 z-50 border-b border-stroke bg-panel/95 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <div class="flex items-center gap-3">
        <img src="./assets/ladyjusticebribed.png" alt="Allegations of Bribery" class="h-8 w-8 rounded bg-slate-700 object-contain p-1" />
        <div class="text-lg font-semibold tracking-tight">Allegations of Bribery</div>
      </div>

      <nav class="hidden items-center gap-5 text-sm text-slate-300 md:flex">
        <a class="hover:text-white" href="./index.html">Forums</a>
        <a class="hover:text-white" href="#">Documents</a>
        <a class="hover:text-white" href="#">Cases</a>
      </nav>

      <div class="flex items-center gap-3">
        <a id="headerBack" class="rounded-md border border-stroke px-3 py-2 text-sm text-slate-200 hover:bg-slate-800" href="./index.html" style="display:none;">← Back</a>

        <a id="homeLink" href="./index.html" class="rounded-md border border-stroke px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">Home</a>

        <a id="loginLink" href="./login.html" class="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">Log in</a>
        <a id="registerLink" href="./signup.html" class="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">Register</a>

        <span id="userBadge" class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200" style="display:none;" title="">
          <span class="inline-block h-2 w-2 rounded-full bg-emerald-400"></span>
          <span id="userMenuBtn" class="max-w-[220px] truncate font-medium"></span>
        </span>

        <button id="logoutBtn" class="rounded-md border border-stroke px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800" type="button" style="display:none;">Logout</button>
      </div>
    </div>
  </header>`;

  const footerHtml = `
  <footer class="py-4 text-xs text-slate-500">
    <div class="mx-auto max-w-6xl px-4">
      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <span>© <span id="y">${new Date().getFullYear()}</span> Allegations of Bribery</span>
        <div class="flex gap-4">
          <a class="hover:text-slate-300" href="./terms.html">Terms</a>
          <a class="hover:text-slate-300" href="./privacy.html">Privacy</a>
          <a class="hover:text-slate-300" href="#">Security</a>
        </div>
      </div>
    </div>
  </footer>`;

  // Replace or insert header placeholder
  let headerPlaceholder = document.getElementById("siteHeader");
  if (!headerPlaceholder) {
    headerPlaceholder = document.createElement("div");
    headerPlaceholder.id = "siteHeader";
    document.body.insertBefore(headerPlaceholder, document.body.firstChild);
  }
  headerPlaceholder.innerHTML = headerHtml;

  // Hide the Home link when already on the home page
  try {
    const homeLink = document.getElementById("homeLink");
    if (homeLink) {
      const name = (window.location.pathname || "").split("/").pop();
      if (!name || name === "index.html" || name === "index.htm") {
        homeLink.style.display = "none";
      }
    }
  } catch (e) {
    // ignore (server-side render or no window)
  }

  // Replace or insert footer placeholder at end of main
  let footerPlaceholder = document.getElementById("siteFooter");
  if (!footerPlaceholder) {
    footerPlaceholder = document.createElement("div");
    footerPlaceholder.id = "siteFooter";
    document.body.appendChild(footerPlaceholder);
  }
  footerPlaceholder.innerHTML = footerHtml;

  // Wire auth UI
  try {
    await wireAuthButtons();
  } catch (e) {
    // ignore
    console.error("wireAuthButtons failed:", e);
  }

  // Header back behavior: allow pages (like post.js) to set data-back-href
  const headerBack = document.getElementById("headerBack");
  if (headerBack) {
    headerBack.addEventListener("click", (e) => {
      e.preventDefault();
      // If a specific back URL is set, use it. Otherwise try history.back()
      const href = headerBack.getAttribute("data-back-href");
      if (href) {
        window.location.href = href;
        return;
      }
      if (window.history.length > 1) window.history.back();
      else window.location.href = "./index.html";
    });
  }

  return { headerId: "siteHeader", footerId: "siteFooter" };
}
