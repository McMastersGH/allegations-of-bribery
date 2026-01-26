// js/index.js
import { wireAuthButtons } from "./auth.js";
import { listPosts } from "./blogApi.js";

// Always wire auth buttons first (so Login/Logout reflects session state)
// and do not let unrelated page errors prevent it.
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
    return new Date(iso).toLocaleString();
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
    el.className = "item";
    el.innerHTML = `
      <h3 style="margin:0 0 6px 0;">
        <a href="./post.html?id=${encodeURIComponent(p.id)}">${escapeHtml(p.title)}</a>
      </h3>
      <div class="muted">${escapeHtml(fmtDate(p.created_at))}</div>
    `;
    postsList.appendChild(el);
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