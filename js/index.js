// js/index.js
import { wireAuthButtons } from "./auth.js";
import { listPosts } from "./blogApi.js";

// Initialize page after DOM is ready to avoid top-level await and null DOM refs
document.addEventListener("DOMContentLoaded", async () => {
  // Wire auth buttons first; don't let failures block the rest of the page
  try {
    await wireAuthButtons({ loginLinkId: "loginLink", logoutBtnId: "logoutBtn" });
  } catch (e) {
    console.error("wireAuthButtons failed:", e);
  }

  // Everything below is optional rendering; guard it so missing elements do not crash the module.
  const postsList = document.getElementById("postsList");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const refreshBtn = document.getElementById("refreshBtn");
  const yearEl = document.getElementById("year");

  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDate(iso) {
    try {
      if (typeof iso === 'string') {
        iso = iso.replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2})\s+/, '$1T');
        if (/^\d{4}-\d{2}-\d{2}T/.test(iso) && !(/[zZ]$|[+\-]\d{2}:\d{2}$/.test(iso))) {
          iso = iso + 'Z';
        }
      }
      const d = new Date(iso);
      const local = d.toLocaleString();
      const utcIso = d.toISOString().replace('T', ' ').replace('Z', '');
      return `${local} (UTC ${utcIso})`;
    } catch {
      return iso;
    }
  }

  function render(posts) {
    if (!postsList || !emptyState) return;

    postsList.innerHTML = "";

    if (!posts || posts.length === 0) {
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";

    for (const p of posts) {
      const el = document.createElement("div");
      el.innerHTML = `
      <a href="./post.html?id=${encodeURIComponent(p.id)}" class="block rounded-lg border border-stroke bg-panel p-4 mb-3 transition hover:bg-slate-800" data-post-id="${encodeURIComponent(p.id)}">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-slate-200">${escapeHtml(p.title)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(fmtDate(p.created_at))}${p.forum_slug ? ` • ${escapeHtml(p.forum_slug.replace(/-/g, ' '))}` : ''}</div>
          </div>
          <div class="shrink-0 text-xs text-slate-500">Loading…</div>
        </div>
      </a>
    `;
      postsList.appendChild(el);

      // Fetch comments count per post and update the card (small N so N+1 acceptable)
      (async () => {
        try {
          const { listComments } = await import('./blogApi.js');
          const comments = await listComments(p.id);
          const count = Array.isArray(comments) ? comments.length : 0;
          const anchor = postsList.querySelector(`a[data-post-id="${encodeURIComponent(p.id)}"]`);
          if (anchor) {
            const right = anchor.querySelector('.shrink-0');
            if (right) right.innerHTML = `${count} comments`;
          }
        } catch (e) {
          // ignore per-post failures
        }
      })();
    }
  }

  async function load() {
    // If the page doesn’t have the blog list UI, do nothing (but auth buttons still work).
    if (!postsList || !emptyState) return;

    const search = (searchInput?.value || "").trim();
    const posts = await listPosts({ limit: 50, search, publishedOnly: true });
    render(posts);
  }

  if (refreshBtn) refreshBtn.addEventListener("click", load);
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") load();
    });
  }

  // Load posts if the UI exists
  try {
    await load();
  } catch (e) {
    console.error("load() failed:", e);
  }
});