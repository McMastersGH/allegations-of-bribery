// js/yourThreads.js
import { getUser, getSession } from "./auth.js";
import { getAuthorThreadsWithUnviewed, markPostSeen } from "./blogApi.js";

function escapeHtml(s) {
  return String(s || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function fmtDate(iso) {
  try {
    if (typeof iso === 'string') iso = iso.replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2})\s+/, '$1T');
    if (/^\d{4}-\d{2}-\d{2}T/.test(iso) && !(/[zZ]$|[+\-]\d{2}:\d{2}$/.test(iso))) iso = iso + 'Z';
    const d = new Date(iso);
    const local = d.toLocaleString();
    const utcIso = d.toISOString().replace('T', ' ').replace('Z', '');
    return `${local} (UTC ${utcIso})`;
  } catch {
    return iso;
  }
}

function renderList(rows, userId) {
  const container = document.getElementById('threadsList');
  const empty = document.getElementById('emptyState');
  if (!container || !empty) return;
  container.innerHTML = '';
  if (!rows || rows.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  for (const r of rows) {
    const el = document.createElement('div');
    const unviewed = r.unviewed || 0;
    // Build tooltip from recent comment excerpts (if any)
    const excerpts = (r.recent_comments || []).map(c => `${(c.display_name||'')}: ${String(c.excerpt||'').replace(/\n/g,' ')}`);
    const tooltip = excerpts.length ? excerpts.join('\n---\n') : '';

    el.innerHTML = `
      <a href="./post.html?id=${encodeURIComponent(r.id)}" class="block rounded-lg border border-stroke bg-panel p-4 mb-3 transition hover:bg-slate-800" data-post-id="${escapeHtml(r.id)}" title="${escapeHtml(tooltip)}">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-slate-200">${escapeHtml(r.title)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(fmtDate(r.created_at))}${r.forum_slug ? ` • ${escapeHtml(r.forum_slug.replace(/-/g, ' '))}` : ''}</div>
          </div>
          <div class="shrink-0 text-xs text-slate-500">
            ${r.comments_count || 0} comments
            ${unviewed > 0 ? `<span class="ml-2 inline-flex items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">${unviewed}</span>` : ''}
          </div>
        </div>
      </a>
    `;
    container.appendChild(el);
  }
}

function getLastSeenKey(userId, postId) {
  return `lastSeen:${userId}:${postId}`;
}

export default async function initYourThreads() {
  document.addEventListener('DOMContentLoaded', async () => {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    let user = null;
    try {
      const session = await getSession();
      user = session?.user || null;
    } catch (e) {
      user = null;
    }

    if (!user || !user.id) {
      // Not signed in: redirect to login with next
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `./login.html?next=${next}`;
      return;
    }

    const userId = user.id;

    // Use server-side RPC to fetch posts with unviewed counts and recent excerpts in one request
    let rows = [];
    try {
      rows = await getAuthorThreadsWithUnviewed(userId);
    } catch (e) {
      console.error('getAuthorThreadsWithUnviewed failed:', e);
      rows = [];
    }

    // rows already contain comments_count, unviewed_count, recent_comments (jsonb array)
    const enriched = (rows || []).map(r => ({
      ...r,
      recent_comments: r.recent_comments || []
    }));

    renderList(enriched, userId);

    // When the user clicks a post, mark it seen server-side (best-effort)
    document.getElementById('threadsList')?.addEventListener('click', async (e) => {
      const a = e.target.closest('a[data-post-id]');
      if (a) {
        const pid = a.getAttribute('data-post-id');
        try {
          // Fire-and-forget; don't block navigation
          markPostSeen(userId, pid).catch((err) => console.debug('markPostSeen failed:', err));
        } catch (err) {
          console.debug('markPostSeen call error:', err);
        }
      }
    });
  });
}

// Auto-run when included as module
(async () => {
  try {
    await initYourThreads();
  } catch (e) {
    console.debug('initYourThreads error:', e);
  }
})();
