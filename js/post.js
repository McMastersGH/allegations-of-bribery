// js/post.js
import { getPostById, listComments, addComment, listPostFiles } from "./blogApi.js";
import { getPublicUrl } from "./storageApi.js";
import { getSession, getMyProfile, wireAuthButtons, getMyAuthorStatus, setMyAnonymity } from "./auth.js";

const postTitle = document.getElementById("postTitle");
const postMeta = document.getElementById("postMeta");
const postContent = document.getElementById("postContent");
const attachments = document.getElementById("attachments");
const commentsEl = document.getElementById("comments");

const commentGate = document.getElementById("commentGate");
const commentText = document.getElementById("commentText");
const commentBtn = document.getElementById("commentBtn");
const commentMsg = document.getElementById("commentMsg");

// Handle anonymity toggle
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
      <div><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(f.original_name)}</a></div>
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

async function wireCommentForm(post) {
  let currentAnon = false;

  const session = await getSession();

  // Logged out: disable comment form + hide anon toggle UI
  if (!session) {
    commentGate.textContent = "To comment, please log in.";
    commentBtn.disabled = true;
    commentText.disabled = true;

    if (commentAnonPanel) commentAnonPanel.style.display = "none";
    return;
  }

  // Logged in: enable comment form + show anon toggle UI
  commentGate.textContent = "You are logged in.";
  commentBtn.disabled = false;
  commentText.disabled = false;

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
        commentAnonToggle.checked = !commentAnonToggle.checked;
        if (commentAnonStatus) {
          commentAnonStatus.textContent = `Save failed: ${e?.message || String(e)}`;
        }
      }
    };
  }

  // Comment submit
  commentBtn.onclick = async () => {
    
    try {
      commentMsg.textContent = "Posting...";
      const body = (commentText.value || "").trim();
      if (!body) {
        commentMsg.textContent = "Comment cannot be empty.";
        return;
      }

      // Use current toggle position (UI) as source of truth
      
      const status = await getMyAuthorStatus(); // { user_id, display_name, approved, is_anonymous } or null

      const displayName = status?.is_anonymous
      ? "Chose Anonymity"
      : (status?.display_name || "Member");

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

  // Draft access control: author only (status = 'draft')
  if (post.status !== "published") {
    const session = await getSession();
    const isAuthor = session?.user?.id && session.user.id === post.author_id;
    if (!isAuthor) throw new Error("This post is not published.");
  }

  postTitle.textContent = post.title || "";

// NEW: fill the spans inside #postMeta instead of overwriting it
const authorSpan = postMeta.querySelector(".author-name");
const dateSpan = postMeta.querySelector(".post-date");

if (authorSpan) authorSpan.textContent = ""; // leave empty; CSS will show "Chose Anonymity"
if (dateSpan) {
  dateSpan.textContent =
    `Published: ${fmtDate(post.created_at)}` + (post.status === "published" ? "" : " (DRAFT)");
}

  // body is plain text in your schema; render safely
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
}