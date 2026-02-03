// js/index.js
import { wireAuthButtons } from "./auth.js";
import { listPosts } from "./blogApi.js";

console.log('js/index.js module loaded');

async function initIndexModule() {
  // Wire auth buttons first; don't let failures block the rest of the page
  try {
    await wireAuthButtons({ loginLinkId: "loginLink", logoutBtnId: "logoutBtn" });
  } catch (e) {
    console.error("wireAuthButtons failed:", e);
  }

  // Everything below is optional rendering; guard it so missing elements do not crash the module.
  const postsList = document.getElementById("postsList");
  const emptyState = document.getElementById("emptyState");
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
      // Ensure the wrapper doesn't cause horizontal overflow
      el.className = 'w-full';
      el.style.boxSizing = 'border-box';
      el.style.overflowWrap = 'anywhere';
      el.innerHTML = `
      <a href="./post.html?id=${encodeURIComponent(p.id)}" class="block w-full rounded-lg border border-stroke bg-panel p-4 mb-3 transition hover:bg-slate-800" data-post-id="${encodeURIComponent(p.id)}">
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

      // Fetch comments count and latest comment date per post so we can show activity
      (async () => {
        try {
          const { listComments } = await import('./blogApi.js');
          const comments = await listComments(p.id);
          const count = Array.isArray(comments) ? comments.length : 0;
          // Determine latest comment date for activity ranking
          const latest = (Array.isArray(comments) && comments.length) ? comments[comments.length - 1].created_at : null;
          p._activity = { comments: count, latest: latest };
          const anchor = postsList.querySelector(`a[data-post-id="${encodeURIComponent(p.id)}"]`);
          if (anchor) {
            const right = anchor.querySelector('.shrink-0');
            if (right) right.innerHTML = `${count} comments`;
          }
        } catch (e) {
          p._activity = { comments: 0, latest: null };
        }
      })();
    }
  }

  async function load() {
    // If the page doesn’t have the blog list UI, do nothing (but auth buttons still work).
    if (!postsList || !emptyState) return;

    const posts = await listPosts({ limit: 50, publishedOnly: true });

    // Diagnostic logging to help debug empty-state issues (use console.log so it's visible)
    try {
      if (!posts) {
        console.log('listPosts returned NULL/undefined:', posts);
      } else if (!Array.isArray(posts)) {
        console.log('listPosts returned non-array:', typeof posts, posts);
      } else {
        console.log('listPosts returned count:', posts.length, 'titles:', posts.slice(0,5).map(p => p.title));
      }
    } catch (e) { console.error('listPosts diagnostic log failed:', e); }

    // Sort by views_count (most viewed first), fallback to created_at
    try {
      posts.sort((a, b) => {
        const av = (a.views_count && Number(a.views_count)) || 0;
        const bv = (b.views_count && Number(b.views_count)) || 0;
        if (bv !== av) return bv - av;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    } catch (e) {}

    render(posts);

    // Diagnostic: check for any element that became wider than the viewport
    try {
      const w = document.documentElement.clientWidth;
      const offenders = [...document.querySelectorAll('*')].filter(el => el instanceof Element && el.scrollWidth > w);
      if (offenders.length) {
        console.warn('Post-render overflow offenders:', offenders.slice(0,10).map(el => ({ tag: el.tagName, id: el.id, cls: el.className, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })));
        offenders.slice(0,10).forEach(el => {
          try { el.style.outline = '3px solid rgba(255,0,0,0.85)'; el.setAttribute('data-debug-overflow','1'); } catch(e){}
        });
      } else {
        console.log('No overflow offenders detected after render');
      }
    } catch (e) { console.error('overflow diagnostic failed:', e); }
  }

  if (refreshBtn) refreshBtn.addEventListener("click", load);

  // Load posts if the UI exists
  try {
    await load();
  } catch (e) {
    console.error("load() failed:", e);
  }
}

// Ensure initialization runs whether DOMContentLoaded has already fired or not.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initIndexModule().catch(e => console.error('initIndexModule failed:', e)); });
} else {
  initIndexModule().catch(e => console.error('initIndexModule failed:', e));
}
 