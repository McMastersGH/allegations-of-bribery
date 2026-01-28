// js/shell.js
import { wireAuthButtons } from "./auth.js";
import { ENABLE_ADS, ADS_PROVIDER, ADSENSE_CLIENT } from "./config.js";

export default async function initShell() {
  // Inject header
  const headerHtml = `
  <header class="sticky top-0 z-50 border-b border-stroke bg-panel/95 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <div class="flex items-center gap-3">
        <img src="./assets/ladyjusticebribed.png" alt="Allegations of Bribery" class="h-8 w-8 rounded bg-slate-700 object-contain p-1" />
        <div class="text-lg font-semibold tracking-tight">Allegations of Bribery</div>
      </div>

      <!-- Mobile menu button -->
      <button id="mobileMenuBtn" class="md:hidden inline-flex items-center justify-center p-2 rounded-md border border-stroke text-slate-300" aria-expanded="false" aria-label="Menu" type="button">
        <svg id="mobileMenuIcon" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2z" clip-rule="evenodd" />
        </svg>
      </button>

      <nav class="hidden items-center gap-5 text-sm text-slate-300 md:flex">
        <a class="hover:text-white" href="./index.html">Forums</a>
        <a class="hover:text-white" href="#">Documents</a>
        <a class="hover:text-white" href="#">Cases</a>
      </nav>
      <!-- Mobile nav (collapsed by default) -->
      <div id="mobileNav" class="md:hidden hidden absolute left-0 right-0 top-full z-50 border-b border-stroke bg-panel/95">
        <div class="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-2">
          <a class="px-2 py-2 rounded hover:bg-slate-800" href="./index.html">Forums</a>
          <a class="px-2 py-2 rounded hover:bg-slate-800" href="#">Documents</a>
          <a class="px-2 py-2 rounded hover:bg-slate-800" href="#">Cases</a>
        </div>
      </div>

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
    <!-- Optional ad row (controlled by config.ENABLE_ADS) -->
    <div id="headerAd" class="mx-auto hidden max-w-6xl px-4 py-2 lg:block">
      <div class="rounded-lg border border-stroke bg-panel p-2 flex items-center justify-center">
        <div id="ad-slot" class="w-full text-center text-slate-400 text-sm">Ad placeholder</div>
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

  // Mobile menu toggle (small screens)
  try {
    const mobileBtn = document.getElementById("mobileMenuBtn");
    const mobileNav = document.getElementById("mobileNav");
    const mobileIcon = document.getElementById("mobileMenuIcon");
    const hamburgerPath = '<path fill-rule="evenodd" d="M3 5h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2zm0 4h14a1 1 0 010 2H3a1 1 0 110-2z" clip-rule="evenodd" />';
    const closePath = '<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 011.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />';

    if (mobileBtn && mobileNav) {
      mobileBtn.addEventListener("click", () => {
        const expanded = mobileBtn.getAttribute("aria-expanded") === "true";
        mobileBtn.setAttribute("aria-expanded", String(!expanded));
        mobileNav.classList.toggle("hidden");
        if (mobileIcon) mobileIcon.innerHTML = expanded ? hamburgerPath : closePath;
      });
    }
  } catch (e) {
    // ignore
  }

  // Show/hide ad placeholder and optionally load provider script
  try {
    const headerAd = document.getElementById("headerAd");
    if (headerAd) {
      if (ENABLE_ADS) headerAd.classList.remove("hidden");
      else headerAd.classList.add("hidden");
    }

    if (ENABLE_ADS && ADS_PROVIDER === "adsense" && ADSENSE_CLIENT && ADSENSE_CLIENT !== "ca-pub-REPLACE_ME") {
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
      s.crossOrigin = "anonymous";
      document.head.appendChild(s);
      // Note: publisher must replace #ad-slot contents with the proper <ins class="adsbygoogle" ...> markup
    } else {
      // Load dev stub to reserve ad space when ads are disabled
      try {
        const stub = document.createElement("script");
        stub.type = "module";
        stub.src = "./js/adStub.js";
        document.body.appendChild(stub);
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // fail quietly
    console.error("ad integration failed:", e);
  }

  return { headerId: "siteHeader", footerId: "siteFooter" };
}
