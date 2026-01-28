// js/post.js
import { getPostById, listComments, addComment, listPostFiles, updateComment, deleteComment, updatePost, deletePost } from "./blogApi.js";
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

async function renderComments(post) {
  if (!commentsEl) return;
  commentsEl.innerHTML = "";
  const comments = await listComments(post.id);

  if (!comments.length) {
    commentsEl.innerHTML = `<div class="muted">No comments yet.</div>`;
    return;
  }

  // Fetch current session once so we can check ownership
  const session = await getSession();
  const currentUserId = session?.user?.id || null;

  for (const c of comments) {
    const el = document.createElement("div");
    el.className = "item";
    const commenter = c.is_anonymous ? "Anonymous" : (c.display_name || "Member");

    // Determine whether the current user can edit/delete this comment:
    // - comment author (when author_id is present)
    // - OR the post author (thread owner)
    const canManage = !!currentUserId && (
      (c.author_id && currentUserId === c.author_id) ||
      (post.author_id && currentUserId === post.author_id)
    );

    const bodyHtml = `<div class="prose" style="margin-top:8px;white-space:pre-wrap">${escapeHtml(c.body)}</div>`;

    el.innerHTML = `
      <div class="muted"><b>${escapeHtml(commenter)}</b> • ${escapeHtml(fmtDate(c.created_at))}</div>
      ${bodyHtml}
    `;

    if (canManage) {
      const ctrl = document.createElement("div");
      ctrl.style.marginTop = "6px";

      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-sm";
      editBtn.textContent = "Edit";
      editBtn.style.marginRight = "6px";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn-sm btn-danger";
      deleteBtn.textContent = "Delete";

      ctrl.appendChild(editBtn);
      ctrl.appendChild(deleteBtn);
      el.appendChild(ctrl);

      // Edit flow: replace body with a textarea + Save/Cancel
      editBtn.onclick = () => {
        const textarea = document.createElement("textarea");
        textarea.className = "input";
        textarea.style.width = "100%";
        textarea.style.minHeight = "80px";
        textarea.value = c.body || "";

        const saveBtn = document.createElement("button");
        saveBtn.className = "btn btn-sm";
        saveBtn.textContent = "Save";
        saveBtn.style.marginRight = "6px";

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "btn btn-sm";
        cancelBtn.textContent = "Cancel";

        // Replace body HTML with editor
        const bodyEl = el.querySelector(".prose");
        if (bodyEl) bodyEl.replaceWith(textarea);
        ctrl.style.display = "none";

        const actionRow = document.createElement("div");
        actionRow.style.marginTop = "6px";
        actionRow.appendChild(saveBtn);
        actionRow.appendChild(cancelBtn);
        el.appendChild(actionRow);

        saveBtn.onclick = async () => {
          try {
            saveBtn.disabled = true;
            await updateComment(c.id, textarea.value.trim());
            // refresh comments
            await renderComments(post);
          } catch (e) {
            saveBtn.disabled = false;
            alert(`Save failed: ${e?.message || String(e)}`);
          }
        };

        cancelBtn.onclick = () => {
          // simply re-render comments to restore original state
          renderComments(post).catch(() => {});
        };
      };

      deleteBtn.onclick = async () => {
        if (!confirm("Delete this comment? This cannot be undone.")) return;
        try {
          deleteBtn.disabled = true;
          await deleteComment(c.id);
          await renderComments(post);
        } catch (e) {
          deleteBtn.disabled = false;
          alert(`Delete failed: ${e?.message || String(e)}`);
        }
      };
    }

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
        const myUserId = status?.user_id || null;

        await addComment(post.id, body, displayName, isAnon, myUserId);

        if (commentText) commentText.value = "";
        if (commentMsg) commentMsg.textContent = "Posted.";
        await renderComments(post);
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
    if (postContent) postContent.innerHTML = `<div id="postBody" style="white-space:pre-wrap;line-height:1.6">${escapeHtml(post.body || "")}</div>`;

    // If current user is post author, show Edit/Delete controls
    try {
      const session = await getSession();
      const currentUserId = session?.user?.id || null;
      const isPostAuthor = !!currentUserId && currentUserId === post.author_id;
      if (isPostAuthor && postMeta) {
        const postControls = document.createElement("div");
        postControls.style.marginTop = "8px";

        const editPostBtn = document.createElement("button");
        editPostBtn.className = "btn btn-sm";
        editPostBtn.textContent = "Edit post";
        editPostBtn.style.marginRight = "8px";

        const deletePostBtn = document.createElement("button");
        deletePostBtn.className = "btn btn-sm btn-danger";
        deletePostBtn.textContent = "Delete post";

        postMeta.appendChild(postControls);
        postControls.appendChild(editPostBtn);
        postControls.appendChild(deletePostBtn);

        editPostBtn.onclick = () => {
          const bodyEl = document.getElementById("postBody");
          if (!bodyEl) return;
          const textarea = document.createElement("textarea");
          textarea.className = "input";
          textarea.style.width = "100%";
          textarea.style.minHeight = "160px";
          textarea.value = post.body || "";

          bodyEl.replaceWith(textarea);
          postControls.style.display = "none";

          const saveBtn = document.createElement("button");
          saveBtn.className = "btn btn-sm";
          saveBtn.textContent = "Save";
          saveBtn.style.marginRight = "8px";

          const cancelBtn = document.createElement("button");
          cancelBtn.className = "btn btn-sm";
          cancelBtn.textContent = "Cancel";

          postControls.parentElement.appendChild(saveBtn);
          postControls.parentElement.appendChild(cancelBtn);

          saveBtn.onclick = async () => {
            try {
              saveBtn.disabled = true;
              await updatePost(post.id, { body: textarea.value || "" });
              // reload page to refresh content and metadata
              window.location.reload();
            } catch (e) {
              saveBtn.disabled = false;
              alert(`Save failed: ${e?.message || String(e)}`);
            }
          };

          cancelBtn.onclick = () => window.location.reload();
        };

        deletePostBtn.onclick = async () => {
          if (!confirm("Delete this thread? This will remove the post and its comments.")) return;
          try {
            deletePostBtn.disabled = true;
            await deletePost(post.id);
            // Redirect back to forum list
            const forum = post?.forum_slug || "";
            const backHref = forum ? `./forum.html?forum=${encodeURIComponent(forum)}` : "./index.html";
            window.location.href = backHref;
          } catch (e) {
            deletePostBtn.disabled = false;
            alert(`Delete failed: ${e?.message || String(e)}`);
          }
        };
      }
    } catch (e) {
      // ignore
    }

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
    await renderComments(post);
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