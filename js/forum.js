// js/forum.js
import { listPosts } from "./blogApi.js";

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