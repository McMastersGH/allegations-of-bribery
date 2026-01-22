import { supabase } from "./supabaseClient.js";

const params = new URLSearchParams(window.location.search);
const forumSlug = params.get("forum");

supabase
  .from("forums")
  .select("slug, title")
  .then(({ data, error }) => {
  });


function getForumSlug() {
  const params = new URLSearchParams(window.location.search);
    return params.get("forum");
}

function escapeHtml(s) {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderThreadRow(post) {
  const title = escapeHtml(post.title);
  const created = post.created_at ? new Date(post.created_at).toLocaleString() : "";
  const id = post.id;

  // Later: post.html?id=<id>
  return `
    <a href="post.html?id=${encodeURIComponent(id)}"
       class="block py-4 hover:bg-[#111827] px-2 rounded">
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-slate-100">${title}</div>
          <div class="mt-1 text-xs text-slate-400">
            ${created}
          </div>
        </div>
        <div class="shrink-0 text-xs text-slate-500">
          View →
        </div>
      </div>
    </a>
  `;
}

async function loadForumMeta(slug) {
  // Optional but recommended: store titles/descriptions in forums table
  const { data, error } = await supabase
    .from("forums")
    .select("title, description")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;

  const titleEl = document.getElementById("forumTitle");
  const descEl = document.getElementById("forumDesc");

  if (!data) {
    titleEl.textContent = slug;
    descEl.textContent = "";
    return;
  }

  titleEl.textContent = data.title ?? slug;
  descEl.textContent = data.description ?? "";
  document.title = `${data.title ?? slug} | Forums`;
}

async function loadThreads(slug) {
  const statusEl = document.getElementById("status");
  const threadsEl = document.getElementById("threads");

  statusEl.textContent = "Loading…";

  // Pull posts/threads for this forum
  // Adjust fields to match your posts table
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, created_at")
    .eq("forum_slug", slug)
    .eq("status", "published")        // remove if you don't use this field
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  if (!data || data.length === 0) {
    threadsEl.innerHTML = `
      <div class="py-6 text-sm text-slate-400">
        No threads yet.
      </div>
    `;
    statusEl.textContent = "0 threads";
    return;
  }

  threadsEl.innerHTML = data.map(renderThreadRow).join("");
  statusEl.textContent = `${data.length} thread${data.length === 1 ? "" : "s"}`;
}

(async function init() {
  const slug = getForumSlug();

  if (!slug) {
    // Hard fail to avoid confusing UI
    document.getElementById("forumTitle").textContent = "Forum not specified";
    document.getElementById("forumDesc").textContent = "Missing ?forum= in URL.";
    document.getElementById("threads").innerHTML = `
      <div class="py-6 text-sm text-slate-400">
        Return to <a class="text-sky-300 hover:text-sky-200" href="index.html">Forums</a>.
      </div>
    `;
    return;
  }

  try {
    await loadForumMeta(slug);
  } catch {
    // If forums table doesn't exist yet, we still let the thread list load.
    document.getElementById("forumTitle").textContent = slug;
  }

  try {
    await loadThreads(slug);
  } catch (e) {
    console.error(e);
    document.getElementById("status").textContent = "Error";
    document.getElementById("threads").innerHTML = `
      <div class="py-6 text-sm text-rose-300">
        Error loading threads. Check console, RLS policies, and Supabase keys.
      </div>
    `;
  }
})();