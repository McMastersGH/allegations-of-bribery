// js/index.js
import { listPosts } from "./blogApi.js";
import { wireAuthButtons } from "./auth.js";

const postsList = document.getElementById("postsList");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

document.getElementById("year").textContent = String(new Date().getFullYear());

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
  const search = (searchInput?.value || "").trim();
  const posts = await listPosts({ limit: 50, search, publishedOnly: true });
  render(posts);
}

document.getElementById("refreshBtn").addEventListener("click", load);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") load();
});

await wireAuthButtons({ loginLinkId: "loginLink", logoutBtnId: "logoutBtn" });
await load();
