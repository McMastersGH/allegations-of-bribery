// js/post.js
import { getPostById, listComments, addComment, listPostFiles } from "./blogApi.js";
import { getPublicUrl } from "./storageApi.js";
import {
  getSession,
  getMyAuthorStatus,
  setMyAnonymity,
  wireAuthButtons
} from "./auth.js";

const postTitle = document.getElementById("postTitle");
const postMeta = document.getElementById("postMeta");
const postContent = document.getElementById("postContent");
const attachments = document.getElementById("attachments");
const commentsEl = document.getElementById("comments");

const commentGate = document.getElementById("commentGate");
const commentText = document.getElementById("commentText");
const commentBtn = document.getElementById("commentBtn");
const commentMsg = document.getElementById("commentMsg");

// Comment anonymity UI (these IDs exist in your post.html)
const commentAnonPanel = document.getElementById("commentAnonPanel");
const commentAnonToggle = document.getElementById("commentAnonToggle");
const commentAnonStatus = document.getElementById("commentAnonStatus");

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

function getId() {
  const u = new URL(window.location.href);
  return u.searchParams.get("id");
}

async function renderFiles(postId) {
  attachments.innerHTML = "";
  const files = await listPostFiles(postId);

  if (!files.length) {
    attachments.innerHTML = `<div class="muted">No attachments.</div>`;
    return;
  }

  for (const f of files) {
    const url = getPublicUrl(f.bucket, f.object_path);
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(f.original_name)}
        </a>
      </div>
      <div class="muted">${escapeHtml(f.mime_type || "file")} • ${escapeHtml(fmtDate(f.created_at))}</div>
    `;
    attachments.appendChild(el);
  }
}

async function renderComments(postId) {
  commentsEl.innerHTML = "";
  const comments = await listComments(postId);

  if (!comments.length) {
    commentsEl.innerHTML = `<div class="muted">No comments yet.</div>`;
    return;
  }

  for (const c of comments) {
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="muted"><b>${escapeHtml(c.display_name || "Member")}</b> • ${escapeHtml(fmtDate(c.created_at))}</div>
      <div class="prose" style="margin-top:8px;white-space:pre-wrap">${escapeHtml(c.body)}</div>
    `;
    commentsEl.appendChild(el);
  }
}

function setPostMeta(post) {
  // post.html has:
  // <p class="muted" id="postMeta">
  //   <span class="author-name"></span>
  //   <span class="post-date"></span>
  // </p>

  const authorSpan = postMeta?.querySelector(".author-name");
  const dateSpan = postMeta?.querySelector(".post-date");

  // If you later add posts.author_display, this will show it.
  // If not present/null, leave empty and your CSS fallback text will render.
  if (authorSpan) {
    authorSpan.textContent = post?.author_display ? String(post.author_display) : "";
  }

  if (dateSpan) {
    dateSpan.textContent =
      `Published: ${fmtDate(post.created_at)}` + (post.status === "published" ? "" : " (DRAFT)");
  }
}

async function wireCommentForm(post) {
  const session = await getSession();

  // Logged out
  if (!session) {
    commentGate.textContent = "To comment, please log in.";
    commentBtn.disabled = true;
    commentText.disabled = true;

    if (commentAnonPanel) commentAnonPanel.style.display = "none";
    return;
  }

  // Logged in
  commentGate.textContent = "You are logged in.";
  commentBtn.disabled = false;
  commentText.disabled = false;

  if (commentAnonPanel) commentAnonPanel.style.display = "";
  if (commentAnonToggle) commentAnonToggle.disabled = false;

  // Load current anonymity from DB and set checkbox
  try {
    const status = await getMyAuthorStatus(); // { user_id, display_name, approved, is_anonymous }
    const isAnon = !!status?.is_anonymous;

    if (commentAnonToggle) commentAnonToggle.checked = isAnon;

    if (commentAnonStatus) {
      commentAnonStatus.textContent = isAnon
        ? "Anonymity is ON. Your comments will show “Chose Anonymity”."
        : "Anonymity is OFF. Your name will be shown when available.";
    }
  } catch (e) {
    if (commentAnonStatus) {
      commentAnonStatus.textContent = `Could not load anonymity status: ${e?.message || String(e)}`;
    }
  }

  // Save changes when toggled
  if (commentAnonToggle) {
    commentAnonToggle.onchange = async () => {
      try {
        const next = !!commentAnonToggle.checked;

        commentAnonToggle.disabled = true;
        if (commentAnonStatus) commentAnonStatus.textContent = "Saving...";

        await setMyAnonymity(next);

        if (commentAnonStatus) {
          commentAnonStatus.textContent = next
            ? "Saved. Anonymity is ON."
            : "Saved. Anonymity is OFF.";
        }
      } catch (e) {
        // revert checkbox
        commentAnonToggle.checked = !commentAnonToggle.checked;
        if (commentAnonStatus) commentAnonStatus.textContent = `Save failed: ${e?.message || String(e)}`;
      } finally {
        commentAnonToggle.disabled = false;
      }
    };
  }

  // Post comment
  commentBtn.onclick = async () => {
    try {
      commentMsg.textContent = "Posting...";

      const body = (commentText.value || "").trim();
      if (!body) {
        commentMsg.textContent = "Comment cannot be empty.";
        return;
      }

      // Use the checkbox state *right now* for this comment’s display name
      const anonNow = !!commentAnonToggle?.checked;

      // Pull display_name from your safe RPC
      const status = await getMyAuthorStatus();
      const name = status?.display_name || "Member";

      const displayName = anonNow ? "Chose Anonymity" : name;

      await addComment(post.id, body, displayName);

      commentText.value = "";
      commentMsg.textContent = "Posted.";
      await renderComments(post.id);
    } catch (e) {
      commentMsg.textContent = `Error: ${e?.message || String(e)}`;
    }
  };
}

await wireAuthButtons({ loginLinkId: "loginLink", logoutBtnId: "logoutBtn" });

try {
  const id = getId();
  if (!id) throw new Error("Missing post id.");

  const post = await getPostById(id);
  if (!post) throw new Error("Post not found.");

  // Draft access control: only author can view drafts
  if (post.status !== "published") {
    const session = await getSession();
    const isAuthor = session?.user?.id && session.user.id === post.author_id;
    if (!isAuthor) throw new Error("This post is not published.");
  }

  postTitle.textContent = post.title || "";
  setPostMeta(post);

  postContent.innerHTML = `<div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(post.body || "")}</div>`;

  await renderFiles(post.id);
  await renderComments(post.id);
  await wireCommentForm(post);
} catch (e) {
  postTitle.textContent = "Error";
  postMeta.textContent = "";
  postContent.innerHTML = `<div class="muted">${escapeHtml(e?.message || String(e))}</div>`;
  attachments.innerHTML = "";
  commentsEl.innerHTML = "";
  commentGate.textContent = "";
  commentBtn.disabled = true;
  commentText.disabled = true;

  if (commentAnonPanel) commentAnonPanel.style.display = "none";
}
