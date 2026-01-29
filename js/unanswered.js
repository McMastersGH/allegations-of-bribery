// js/unanswered.js
import { listUnansweredPosts } from "./blogApi.js";

document.addEventListener('DOMContentLoaded', async () => {
  const postsList = document.getElementById('postsList');
  const emptyState = document.getElementById('emptyState');
  const refreshBtn = null;
  const yearEl = document.getElementById('year');

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
        if (/^\d{4}-\d{2}-\d{2}T/.test(iso) && !(/[zZ]$|[+\-]\d{2}:\d{2}$/.test(iso))) iso = iso + 'Z';
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
    postsList.innerHTML = '';
    if (!posts || posts.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    for (const p of posts) {
      const el = document.createElement('div');
      el.innerHTML = `
      <a href="./post.html?id=${encodeURIComponent(p.id)}" class="block rounded-lg border border-stroke bg-panel p-4 mb-3 transition hover:bg-slate-800" data-post-id="${encodeURIComponent(p.id)}">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-slate-200">${escapeHtml(p.title)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(fmtDate(p.created_at))}${p.forum_slug ? ` • ${escapeHtml(p.forum_slug.replace(/-/g, ' '))}` : ''}</div>
          </div>
          <div class="shrink-0 text-xs text-slate-500">0 comments</div>
        </div>
      </a>
    `;
      postsList.appendChild(el);
    }
  }

  async function load() {
    if (!postsList || !emptyState) return;
    try {
      const posts = await listUnansweredPosts({ limit: 200 });
      render(posts);
    } catch (e) {
      console.error('listUnansweredPosts failed:', e);
      render([]);
    }
  }

  // refresh button removed from UI

  try {
    await load();
  } catch (e) {
    console.error('load failed:', e);
  }
});

// Auto-run when included as module
(async () => {})();
