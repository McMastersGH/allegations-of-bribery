// js/forum.js
import { wireAuthButtons, getSession } from "./auth.js";
import { listPosts, getAuthorProfile } from "./blogApi.js";

function $(id){ return document.getElementById(id); }

function getForumSlug(){
  const u = new URL(window.location.href);
  return (u.searchParams.get("forum") || "").trim() || "general-topics";
}

function escapeHtml(s){
  return (s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function setStatus(msg){
  const el = $("status");
  if (el) el.textContent = msg || "";
}

function renderRow(p){
  const title = escapeHtml(p.title || "(untitled)");
  const author = escapeHtml(p.display_name || (p.is_anonymous ? "Anonymous" : "Unknown"));
  const when = p.created_at ? new Date(p.created_at).toLocaleString() : "";
  return `
    <a href="post.html?id=${encodeURIComponent(p.id)}" class="block py-3 hover:bg-slate-900/30">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-slate-200">${title}</div>
          <div class="mt-1 text-xs text-slate-500">
            <span>${author}</span>
            ${when ? `<span class="mx-2">•</span><span>${escapeHtml(when)}</span>` : ""}
          </div>
        </div>
        <div class="shrink-0 text-xs text-slate-500">Open →</div>
      </div>
    </a>
  `;
}

document.addEventListener("DOMContentLoaded", async () => {
  try { await wireAuthButtons(); } catch (e) { console.warn(e); }

  const slug = getForumSlug();

  const titleEl = $("forumTitle");
  const descEl = $("forumDesc");
  if (titleEl) titleEl.textContent = slug.replaceAll("-", " ").replace(/\b\w/g, c => c.toUpperCase());
  if (descEl) descEl.textContent = `Threads in ${slug}`;

  const newBtn = $("newThreadBtn");
  if (newBtn) {
    newBtn.href = `./write.html?forum=${encodeURIComponent(slug)}`;
    newBtn.style.display = "none";
  }

  // Show "New thread" only if logged-in + approved
  let canPost = false;
  try {
    const session = await getSession();
    if (session?.user) {
      const prof = await getAuthorProfile(session.user.id);
      if (prof.ok && prof.profile?.approved) canPost = true;
    }
  } catch {}

  if (newBtn && canPost) newBtn.style.display = "inline-flex";

  // Load posts
  setStatus("Loading...");
  const threadsEl = $("threads");
  if (!threadsEl) return;

  const res = await listPosts(slug, { limit: 100 });
  if (!res.ok) {
    setStatus(res.error || "Failed to load threads.");
    return;
  }

  const posts = res.posts || [];
  setStatus(posts.length ? "" : "No threads yet.");
  threadsEl.innerHTML = posts.map(renderRow).join("");
});