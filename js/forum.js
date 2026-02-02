// js/forum.js
import { listPosts } from "./blogApi.js";
import { getSupabaseClient } from "./supabaseClient.js";
import { deleteForum } from "./forumApi.js";

const $ = (id) => document.getElementById(id);

function forumMeta(slug) {
  const map = {
    "general-topics": {
      title: "General Topics",
      desc: "Threads in general-topics",
    },
    "union-matters": {
      title: "Union Matters",
      desc: "Discuss union organizing, labor disputes, contracts, and member issues.",
    },
    "questions-and-answers": {
      title: "Questions & Answers",
      desc: "Ask for clarification, document analysis, and procedural guidance.",
    },
    "off-topic": {
      title: "Off-topic",
      desc: "Anything not directly related to cases, filings, or records.",
    },
  };
  return map[slug] || { title: slug, desc: `Threads in ${slug}` };
}

function setStatus(msg, isError = false) {
  const el = $("status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("text-rose-300", !!isError);
  el.classList.toggle("text-slate-500", !isError);
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderThreads(rows) {
  const wrap = $("threads");
  if (!wrap) return;

  if (!rows?.length) {
    wrap.innerHTML = `<div class="py-4 text-sm text-slate-400">No threads yet.</div>`;
    return;
  }

  wrap.innerHTML = rows
    .map((r) => {
      const title = escapeHtml(r.title);
      const when = r.created_at ? new Date(r.created_at).toLocaleString() : "";
      const by = escapeHtml(r.display_name || "Unknown");
      return `
        <a href="./post.html?id=${encodeURIComponent(r.id)}"
           class="block px-2 py-4 hover:bg-slate-900/40">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-slate-200">${title}</div>
              <div class="mt-1 text-xs text-slate-500">By ${by} • ${escapeHtml(when)}</div>
            </div>
            <div class="shrink-0 text-xs text-slate-500">View</div>
          </div>
        </a>
      `;
    })
    .join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  const u = new URL(window.location.href);
  const slug = (u.searchParams.get("forum") || "general-topics").trim();

  const meta = forumMeta(slug);
  if ($("forumTitle")) $("forumTitle").textContent = meta.title;
  if ($("forumDesc")) $("forumDesc").textContent = meta.desc;

  // Wire "New thread" button if present
  const newBtn = $("newThreadBtn");
  if (newBtn) {
    newBtn.href = `./write.html?forum=${encodeURIComponent(slug)}`;
  }

  // Admin controls: delete forum (only visible to admins)
  try {
    const sb = getSupabaseClient();
    const { data: isAdminData, error: isAdminErr } = await sb.rpc('is_admin');
    const isAdmin = isAdminData === true || (Array.isArray(isAdminData) && isAdminData[0] === true);
    if (isAdmin) {
      const titleEl = $("forumTitle");
      const flexRow = titleEl?.parentElement?.parentElement;
      if (flexRow) {
        const adminWrap = document.createElement('div');
        adminWrap.id = 'forumAdminControls';
        adminWrap.className = 'flex items-center gap-2';

        const delBtn = document.createElement('button');
        delBtn.className = 'rounded-md bg-rose-600 px-3 py-1 text-sm font-semibold text-white hover:bg-rose-500';
        delBtn.textContent = 'Delete forum';

        const confirmArea = document.createElement('div');
        confirmArea.style.display = 'none';
        confirmArea.className = 'ml-3';
        confirmArea.innerHTML = `
          <div class="mt-2">
            <textarea id="deleteReason" rows="3" class="w-64 p-2 rounded border border-rose-600 bg-slate-900 text-rose-300" placeholder="Enter deletion reason (visible to admins)"></textarea>
            <div class="mt-2 flex gap-2">
              <button id="confirmDeleteBtn" class="px-3 py-1 rounded bg-rose-700 text-white">Confirm delete</button>
              <button id="cancelDeleteBtn" class="px-3 py-1 rounded bg-slate-700 text-slate-200">Cancel</button>
            </div>
          </div>
        `;

        adminWrap.appendChild(delBtn);
        adminWrap.appendChild(confirmArea);
        flexRow.appendChild(adminWrap);

        // If logout navigation doesn't occur (some browsers), listen for the
        // global `signedOut` event and remove/hide admin controls immediately.
        try {
          window.addEventListener('signedOut', () => {
            try { const el = document.getElementById('forumAdminControls'); if (el) el.remove(); } catch (e) {}
          });
        } catch (e) {}

        delBtn.addEventListener('click', () => {
          const showing = confirmArea.style.display === 'none';
          confirmArea.style.display = showing ? 'block' : 'none';
          delBtn.style.display = showing ? 'none' : 'inline-block';
        });

        confirmArea.addEventListener('click', async (ev) => {
          const target = ev.target;
          if (target && target.id === 'cancelDeleteBtn') {
            confirmArea.style.display = 'none';
            delBtn.style.display = 'inline-block';
            return;
          }
          if (target && target.id === 'confirmDeleteBtn') {
            const reason = document.getElementById('deleteReason')?.value || null;
            target.disabled = true;
            try {
              setStatus('Deleting forum…');
              await deleteForum(slug, reason);
              // Redirect to forums list after deletion
              window.location.href = './forums.html';
            } catch (e) {
              console.error('Delete forum failed', e);
              setStatus('Failed to delete forum: ' + String(e), true);
              target.disabled = false;
            }
          }
        });
      }
    }
  } catch (e) {
    // ignore admin control errors
  }

  setStatus("Loading…");

  try {
    // Use shared API which provides `display_name` on each post.
    const rows = await listPosts({ limit: 50, forum_slug: slug, publishedOnly: true });
    setStatus("");
    renderThreads(rows || []);
  } catch (e) {
    console.error("Forum exception:", e);
    setStatus(`Failed to load threads: ${String(e)}`, true);
    renderThreads([]);
  }
});