// js/post.js
import { getPostById, listComments, addComment, listPostFiles } from "./blogApi.js";
import { getPublicUrl } from "./storageApi.js";
import { getSession, wireAuthButtons, getMyAuthorStatus, setMyAnonymity } from "./auth.js";

let postTitle;
let postMeta;
let postContent;
let attachments;
let commentsEl;

let commentGate;
let commentText;
let commentBtn;
let commentMsg;

// Handle anonymity toggle
let commentAnonPanel;
let commentAnonToggle;
let commentAnonStatus;

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
  if (!attachments) return;
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
      <div><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(f.original_name)}</a></div>
      <div class="muted">${escapeHtml(f.mime_type || "file")} • ${escapeHtml(fmtDate(f.created_at))}</div>
    `;
    attachments.appendChild(el);
  }
}

async function renderComments(postId) {
  if (!commentsEl) return;
  commentsEl.innerHTML = "";
  const comments = await listComments(postId);

  if (!comments.length) {
    commentsEl.innerHTML = `<div class="muted">No comments yet.</div>`;
    return;
  }

  for (const c of comments) {
    const el = document.createElement("div");
    el.className = "item";
    const commenter = c.is_anonymous ? "Anonymous" : (c.display_name || "Member");
    el.innerHTML = `
      <div class="muted"><b>${escapeHtml(commenter)}</b> • ${escapeHtml(fmtDate(c.created_at))}</div>
      <div class="prose" style="margin-top:8px;white-space:pre-wrap">${escapeHtml(c.body)}</div>
    `;
    commentsEl.appendChild(el);
  }
}

async function wireCommentForm(post) {

  const session = await getSession();

  // Logged out: disable comment form + hide anon toggle UI
  if (!session) {
    if (commentGate) commentGate.textContent = "To comment, please log in.";
    if (commentBtn) commentBtn.disabled = true;
    if (commentText) commentText.disabled = true;

    if (commentAnonPanel) commentAnonPanel.style.display = "none";
    return;
  }

  // Logged in: enable comment form + show anon toggle UI
  if (commentGate) commentGate.textContent = "You are logged in.";
  if (commentBtn) commentBtn.disabled = false;
  if (commentText) commentText.disabled = false;

  if (commentAnonPanel) commentAnonPanel.style.display = "";
  if (commentAnonToggle) commentAnonToggle.disabled = false;

  // Initialize toggle state from DB
  try {
    const status = await getMyAuthorStatus(); // { is_anonymous, ... }
    const isAnon = !!status?.is_anonymous;

    if (commentAnonToggle) commentAnonToggle.checked = isAnon;
    if (commentAnonStatus) {
      commentAnonStatus.textContent = isAnon
        ? "Anonymity is ON for your account."
        : "Anonymity is OFF for your account.";
    }
  } catch (e) {
    if (commentAnonStatus) {
      commentAnonStatus.textContent = `Could not load anonymity status: ${e?.message || String(e)}`;
    }
  }

  // Persist toggle changes immediately
  if (commentAnonToggle) {
    commentAnonToggle.onchange = async () => {
      try {
        const next = !!commentAnonToggle.checked;
        if (commentAnonStatus) commentAnonStatus.textContent = "Saving...";
        await setMyAnonymity(next);
        if (commentAnonStatus) {
          commentAnonStatus.textContent = next
            ? "Anonymity is ON for your account."
            : "Anonymity is OFF for your account.";
        }
      } catch (e) {
        // revert UI if save fails
        if (commentAnonToggle) commentAnonToggle.checked = !commentAnonToggle.checked;
        if (commentAnonStatus) {
          commentAnonStatus.textContent = `Save failed: ${e?.message || String(e)}`;
        }
      }
    };
  }

  // Comment submit
  if (commentBtn) {
    commentBtn.onclick = async () => {
      try {
        if (commentMsg) commentMsg.textContent = "Posting...";
        const body = (commentText?.value || "").trim();
        if (!body) {
          if (commentMsg) commentMsg.textContent = "Comment cannot be empty.";
          return;
        }

        // Use current toggle position (UI) as source of truth
        const status = await getMyAuthorStatus(); // { user_id, display_name, approved, is_anonymous } or null

        const isAnon = !!status?.is_anonymous;
        const displayName = status?.display_name || null;

        await addComment(post.id, body, displayName, isAnon);

        if (commentText) commentText.value = "";
        if (commentMsg) commentMsg.textContent = "Posted.";
        await renderComments(post.id);
      } catch (e) {
        if (commentMsg) commentMsg.textContent = `Error: ${e?.message || String(e)}`;
      }
    };
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  // Assign DOM nodes after DOM is ready
  postTitle = document.getElementById("postTitle");
  postMeta = document.getElementById("postMeta");
  postContent = document.getElementById("postContent");
  attachments = document.getElementById("attachments");
  commentsEl = document.getElementById("comments");

  commentGate = document.getElementById("commentGate");
  commentText = document.getElementById("commentText");
  commentBtn = document.getElementById("commentBtn");
  commentMsg = document.getElementById("commentMsg");

  commentAnonPanel = document.getElementById("commentAnonPanel");
  commentAnonToggle = document.getElementById("commentAnonToggle");
  commentAnonStatus = document.getElementById("commentAnonStatus");

  await wireAuthButtons({ loginLinkId: "loginLink", logoutBtnId: "logoutBtn" });

  try {
    const id = getId();
    if (!id) throw new Error("Missing post id.");

    const post = await getPostById(id);
    if (!post) throw new Error("Post not found.");

    // Draft access control: author only (status = 'draft')
    if (post.status !== "published") {
      const session = await getSession();
      const isAuthor = session?.user?.id && session.user.id === post.author_id;
      if (!isAuthor) throw new Error("This post is not published.");
    }

    if (postTitle) postTitle.textContent = post.title || "";

    // NEW: fill the spans inside #postMeta instead of overwriting it
    const authorSpan = postMeta?.querySelector(".author-name");
    const dateSpan = postMeta?.querySelector(".post-date");

    if (authorSpan) authorSpan.textContent = post?.is_anonymous ? "Anonymous" : (post?.display_name || "Member");
    if (dateSpan) {
      dateSpan.textContent =
        `Published: ${fmtDate(post.created_at)}` + (post.status === "published" ? "" : " (DRAFT)");
    }

    // body is plain text in your schema; render safely
    if (postContent) postContent.innerHTML = `<div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(post.body || "")}</div>`;

    // Ensure header back button (in shared header) points to the forum thread list
    try {
      const headerBack = document.getElementById("headerBack");
      if (headerBack) {
        const forum = post?.forum_slug || "";
        const backHref = forum ? `./forum.html?forum=${encodeURIComponent(forum)}` : "./index.html";
        headerBack.setAttribute("data-back-href", backHref);
        headerBack.style.display = "inline-flex";
      }
    } catch (e) {
      // ignore
    }

    await renderFiles(post.id);
    await renderComments(post.id);
    await wireCommentForm(post);
  } catch (e) {
    if (postTitle) postTitle.textContent = "Error";
    if (postMeta) postMeta.textContent = "";
    if (postContent) postContent.innerHTML = `<div class="muted">${escapeHtml(e?.message || String(e))}</div>`;
    if (attachments) attachments.innerHTML = "";
    if (commentsEl) commentsEl.innerHTML = "";
    if (commentGate) commentGate.textContent = "";
    if (commentBtn) commentBtn.disabled = true;
    if (commentText) commentText.disabled = true;
  }
});