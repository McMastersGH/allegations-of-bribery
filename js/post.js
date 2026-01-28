// js/post.js
import { getPostById, listComments, addComment, listPostFiles, updateComment, deleteComment, updatePost, deletePost, deletePostFile } from "./blogApi.js";
import { getPublicUrl } from "./storageApi.js";
import { getSession, wireAuthButtons, getMyAuthorStatus, setMyAnonymity } from "./auth.js";
import { uploadAndRecordFiles } from "./uploader.js";
import { bucketExists } from "./storageApi.js";
import { POST_UPLOADS_BUCKET, SITE_TIMEZONE } from "./config.js";

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
let editingPost = false;

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Lightweight modal viewer for images and PDFs
let __fileModal = null;
function showFileModal(url, mime, opener) {
  try {
    // If already open, replace content
    if (!__fileModal) {
      const overlay = document.createElement('div');
      overlay.className = 'file-modal-overlay';
      overlay.tabIndex = -1;

      const wrap = document.createElement('div');
      wrap.className = 'file-modal';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'btn file-modal-close';
      closeBtn.textContent = 'Close';
      closeBtn.type = 'button';
      closeBtn.onclick = () => closeFileModal();

      const content = document.createElement('div');
      content.className = 'file-modal-content';

      wrap.appendChild(closeBtn);
      wrap.appendChild(content);
      overlay.appendChild(wrap);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFileModal();
      });

      document.addEventListener('keydown', __onFileModalKeydown);

      __fileModal = { overlay, wrap, content, closeBtn, opener };
      document.body.appendChild(overlay);
    }

    // Populate content based on mime
    const { content, closeBtn } = __fileModal;
    content.innerHTML = '';
    if (mime && mime.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = opener?.textContent || '';
      img.className = 'file-modal-image';
      content.appendChild(img);
    } else if (mime === 'application/pdf') {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.className = 'file-modal-iframe';
      iframe.setAttribute('aria-label', 'PDF preview');
      content.appendChild(iframe);
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.textContent = 'Open file';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      content.appendChild(link);
    }

    // Show overlay and focus close button
    __fileModal.overlay.style.display = 'flex';
    closeBtn.focus();
  } catch (e) {
    // Swallow errors; fallback is default navigation
    console.error('showFileModal error', e);
  }
}

function __onFileModalKeydown(e) {
  if (!__fileModal) return;
  if (e.key === 'Escape') closeFileModal();
}

function closeFileModal() {
  if (!__fileModal) return;
  try {
    const opener = __fileModal.opener;
    __fileModal.overlay.remove();
    document.removeEventListener('keydown', __onFileModalKeydown);
    __fileModal = null;
    if (opener && typeof opener.focus === 'function') opener.focus();
  } catch (e) {
    __fileModal = null;
  }
}

function fmtDate(iso, tzOverride) {
  try {
    // Normalize common timestamp formats so Date parsing is consistent:
    // - replace space between date and time with 'T'
    // - treat timezone-less timestamps as UTC by appending 'Z'
    if (typeof iso === 'string') {
      iso = iso.replace(/^([0-9]{4}-[0-9]{2}-[0-9]{2})\s+/, '$1T');
      // Detect trailing timezone offsets like +00, +0000, or +00:00
      if (/^\d{4}-\d{2}-\d{2}T/.test(iso) && !(/[zZ]$|[+\-]\d{2}(:?\d{2})?$/.test(iso))) {
        iso = iso + 'Z';
      }
    }
    const d = new Date(iso);

    // Prefer an explicit override, then SITE_TIMEZONE, then the browser locale
    const tz = tzOverride || SITE_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      const opts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      const inZone = new Intl.DateTimeFormat(undefined, { ...opts, timeZone: tz }).format(d);
      const utcIso = d.toISOString().replace('T', ' ').replace('Z', '');
      return `${inZone} (${tz} ${utcIso})`;
    } catch (e) {
      // Fall back to browser-local formatting on error
    }

    const local = d.toLocaleString();
    const utcIso = d.toISOString().replace('T', ' ').replace('Z', '');
    return `${local} (UTC ${utcIso})`;
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

  // Determine whether current user is the post author so we can show upload controls
  const session = await getSession();
  const currentUserId = session?.user?.id || null;
  let isPostAuthor = false;
  try {
    const post = await getPostById(postId);
    isPostAuthor = !!currentUserId && currentUserId === post.author_id;
  } catch {
    // ignore - conservative default is false
  }

  // Helper to create upload UI (shown when there are no files, or for authors)
  const makeUploadUi = () => {
    const wrapper = document.createElement("div");
    wrapper.style.marginTop = "8px";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.multiple = true;
    fileInput.className = "input";
    fileInput.style.display = "block";

    const uploadBtn = document.createElement("button");
    uploadBtn.className = "btn btn-sm";
    uploadBtn.textContent = "Upload attachments";
    uploadBtn.style.marginTop = "6px";

    const status = document.createElement("div");
    status.className = "muted";
    status.style.marginTop = "6px";
    // Preflight: check auth and whether the target bucket exists and is accessible
    (async () => {
      try {
        // Disable uploads if user not signed in
        if (!currentUserId) {
          status.innerHTML = `Please <a href="login.html">sign in</a> to upload attachments.`;
          fileInput.disabled = true;
          uploadBtn.disabled = true;
          return;
        }

        const ok = await bucketExists(POST_UPLOADS_BUCKET);
        if (!ok) {
          status.innerHTML = `Storage bucket "${POST_UPLOADS_BUCKET}" not found. Create it in <a href="https://app.supabase.com" target="_blank" rel="noopener">Supabase Storage</a> or change the bucket name in the client configuration.`;
          fileInput.disabled = true;
          uploadBtn.disabled = true;
        }
      } catch (e) {
        status.textContent = `Could not check storage: ${e?.message || String(e)}`;
        fileInput.disabled = true;
        uploadBtn.disabled = true;
      }
    })();

    uploadBtn.onclick = async () => {
      try {
        if (!fileInput.files || !fileInput.files.length) {
          status.textContent = "No files selected.";
          return;
        }
        uploadBtn.disabled = true;
        status.textContent = "Uploading...";

        const authorId = currentUserId;
        if (!authorId) throw new Error("Not authenticated.");

        await uploadAndRecordFiles({ postId, authorId, files: Array.from(fileInput.files) });

        status.textContent = "Upload complete.";
        // Re-render files to show newly added attachments
        await renderFiles(postId);
      } catch (e) {
        status.textContent = `Upload failed: ${e?.message || String(e)}`;
        uploadBtn.disabled = false;
      }
    };

    wrapper.appendChild(fileInput);
    wrapper.appendChild(uploadBtn);
    wrapper.appendChild(status);
    return wrapper;
  };

  if (!files.length) {
    const none = document.createElement("div");
    none.className = "muted";
    none.textContent = "No attachments.";
    attachments.appendChild(none);

    // If post author, show upload UI in-place where the "No attachments." message is
    if (isPostAuthor) {
      attachments.appendChild(makeUploadUi());
    }
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

    // Add preview area (shown by default) with a hide/show toggle
    const previewWrap = document.createElement("div");
    previewWrap.style.marginTop = "6px";

    const mime = (f.mime_type || "").toLowerCase();

    const makeToggle = (targetEl, showText = "Hide preview", hideText = "Show preview") => {
      const btn = document.createElement("button");
      btn.className = "btn btn-sm";
      // Start previews hidden to avoid clutter; button shows 'Show preview'
      try { targetEl.style.display = "none"; } catch (e) {}
      btn.textContent = hideText;
      btn.style.marginTop = "6px";
      btn.onclick = () => {
        if (targetEl.style.display === "none") {
          // If this element has a lazy loader, run it once before showing
          try {
            if (!targetEl.__lazyLoaded && typeof targetEl.__lazyLoad === 'function') {
              targetEl.__lazyLoad();
              targetEl.__lazyLoaded = true;
            }
          } catch (e) {}
          targetEl.style.display = "block";
          btn.textContent = showText;
        } else {
          targetEl.style.display = "none";
          btn.textContent = hideText;
        }
      };
      return btn;
    };

    // Image preview (inline thumbnail) — shown by default, can hide
    if (mime.startsWith("image/")) {
      const img = document.createElement("img");
      // Defer loading until preview shown to avoid mobile auto-downloads
      img.dataset.src = url;
      img.alt = f.original_name || "image";
      img.style.maxHeight = "160px";
      img.style.display = "block";
      img.style.marginTop = "6px";
      img.style.cursor = "pointer";
      img.onclick = (e) => {
        e.preventDefault();
        showFileModal(url, mime, e.currentTarget);
      };
      // lazy loader
      img.__lazyLoad = () => { img.src = img.dataset.src; };
      previewWrap.appendChild(makeToggle(img, "Hide preview", "Show preview"));
      previewWrap.appendChild(img);
    }

    // PDF preview: embed iframe by default with hide/show toggle
    else if (mime === "application/pdf") {
      const iframe = document.createElement("iframe");
      // Defer loading until preview shown
      iframe.dataset.src = url;
      iframe.style.width = "100%";
      iframe.style.height = "480px";
      iframe.style.marginTop = "8px";
      iframe.__lazyLoad = () => { iframe.src = iframe.dataset.src; };
      previewWrap.appendChild(makeToggle(iframe, "Hide preview", "Show preview"));
      previewWrap.appendChild(iframe);
    }

    // Text preview: fetch first chunk and display truncated, with toggle
    else if (mime.startsWith("text/") || mime === "application/json") {
      const pre = document.createElement("pre");
      pre.className = "prose";
      pre.style.whiteSpace = "pre-wrap";
      pre.style.maxHeight = "220px";
      pre.style.overflow = "auto";
      pre.style.marginTop = "6px";
      pre.textContent = "Preview not loaded.";
      // Defer fetching text until preview shown
      pre.__lazyLoad = async () => {
        pre.textContent = "Loading preview...";
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const text = await resp.text();
          const max = 2000;
          pre.textContent = text.length > max ? text.slice(0, max) + "\n\n... (truncated)" : text;
        } catch (e) {
          pre.textContent = `Preview unavailable: ${e?.message || String(e)}`;
        }
      };

      previewWrap.appendChild(makeToggle(pre, "Hide preview", "Show preview"));
      previewWrap.appendChild(pre);
    }

    // Fallback: no preview available
    else {
      // nothing extra for unknown types
    }

    // If author is editing the post, show delete control per attachment
    if (isPostAuthor && editingPost) {
      const ctrl = document.createElement('div');
      ctrl.style.marginTop = '6px';
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-sm btn-danger';
      delBtn.textContent = 'Delete attachment';
      delBtn.onclick = async () => {
        if (!confirm('Delete this attachment? This will remove the file and its record.')) return;
        try {
          delBtn.disabled = true;
          await deletePostFile(f.id);
          await renderFiles(postId);
        } catch (e) {
          delBtn.disabled = false;
          alert(`Delete failed: ${e?.message || String(e)}`);
        }
      };
      ctrl.appendChild(delBtn);
      el.appendChild(ctrl);
    }
    // Intercept anchor clicks so devices that would normally download
    // a file instead toggle the inline preview (when available).
    try {
      const anchor = el.querySelector('a');
      if (anchor) {
        anchor.addEventListener('click', (ev) => {
          try {
            // Find the preview element (first non-button child of previewWrap)
            const previewEl = Array.from(previewWrap.children).find(c => !c.matches || !c.matches('button'));
            const isVisible = previewEl && window.getComputedStyle(previewEl).display !== 'none';

            // For images and PDFs: only open modal if the inline preview is currently visible.
            if ((mime.startsWith('image/') || mime === 'application/pdf')) {
              if (isVisible) {
                ev.preventDefault();
                showFileModal(url, mime, ev.currentTarget);
              } else if (previewEl) {
                // Reveal the preview instead of navigating
                ev.preventDefault();
                const toggle = previewWrap.querySelector('button.btn');
                if (toggle) toggle.click();
              }
              return;
            }

            // For other types: if an inline preview exists, toggle it
            if (previewEl) {
              ev.preventDefault();
              const toggle = previewWrap.querySelector('button.btn');
              if (toggle) toggle.click();
              else previewWrap.style.display = (previewWrap.style.display === 'none') ? 'block' : 'none';
            }
            // If no preview available, let the default navigation/download happen.
          } catch (e) {
            // On error, fall back to default link behavior
          }
        });
      }
    } catch (e) {
      // Non-fatal: if DOM queries fail, let links behave normally.
    }

    el.appendChild(previewWrap);
    attachments.appendChild(el);
  }

  // If author, allow adding more attachments below the list
  if (isPostAuthor) attachments.appendChild(makeUploadUi());
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
  // Build a tree of comments (parent_id -> children)
  const byId = new Map();
  for (const c of comments) {
    c.children = [];
    byId.set(c.id, c);
  }
  const roots = [];
  for (const c of comments) {
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id).children.push(c);
    } else {
      roots.push(c);
    }
  }

  const renderNode = (c, depth = 0) => {
    const el = document.createElement("div");
    el.className = "item";
    el.style.marginLeft = `${depth * 18}px`;
    const commenter = c.is_anonymous ? "Anonymous" : (c.display_name || "Member");

    const bodyHtml = `<div class="prose" style="margin-top:8px;white-space:pre-wrap">${escapeHtml(c.body)}</div>`;
    el.innerHTML = `
      <div class="muted"><b>${escapeHtml(commenter)}</b> • ${escapeHtml(fmtDate(c.created_at))}</div>
      ${bodyHtml}
    `;

    // Manage controls (edit/delete) same rules as before
    const canManage = !!currentUserId && (
      (c.author_id && currentUserId === c.author_id) ||
      (post.author_id && currentUserId === post.author_id)
    );

    const ctrl = document.createElement("div");
    ctrl.style.marginTop = "6px";

    if (canManage) {
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
            await renderComments(post);
          } catch (e) {
            saveBtn.disabled = false;
            alert(`Save failed: ${e?.message || String(e)}`);
          }
        };

        cancelBtn.onclick = () => renderComments(post).catch(() => {});
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

    // Reply control for authenticated users
    if (currentUserId) {
      const replyBtn = document.createElement("button");
      replyBtn.className = "btn btn-sm";
      replyBtn.textContent = "Reply";
      replyBtn.style.marginLeft = "8px";
      replyBtn.onclick = () => {
        // Avoid adding multiple reply boxes
        if (el.querySelector('.reply-box')) return;
        const textarea = document.createElement('textarea');
        textarea.className = 'input reply-box';
        textarea.style.width = '100%';
        textarea.style.minHeight = '60px';
        textarea.style.marginTop = '6px';

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-sm';
        saveBtn.textContent = 'Reply';
        saveBtn.style.marginTop = '6px';
        saveBtn.style.marginRight = '6px';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-sm';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.marginTop = '6px';

        el.appendChild(textarea);
        el.appendChild(saveBtn);
        el.appendChild(cancelBtn);

        saveBtn.onclick = async () => {
          try {
            saveBtn.disabled = true;
            const body = (textarea.value || '').trim();
            if (!body) {
              alert('Reply cannot be empty.');
              saveBtn.disabled = false;
              return;
            }
            const status = await getMyAuthorStatus();
            const isAnon = !!status?.is_anonymous;
            const displayName = status?.display_name || null;
            const myUserId = status?.user_id || null;
            await addComment(post.id, body, displayName, isAnon, myUserId, c.id);
            await renderComments(post);
          } catch (e) {
            saveBtn.disabled = false;
            alert(`Reply failed: ${e?.message || String(e)}`);
          }
        };

        cancelBtn.onclick = () => {
          const box = el.querySelector('.reply-box');
          if (box) box.remove();
          saveBtn.remove();
          cancelBtn.remove();
        };
      };
      ctrl.appendChild(replyBtn);
    }

    // Attach rendered node
    commentsEl.appendChild(el);

    // Render children recursively
    if (c.children && c.children.length) {
      for (const child of c.children) {
        renderNode(child, depth + 1);
      }
    }
  };

  for (const r of roots) renderNode(r, 0);
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
    
    // Fetch author profile to format timestamps in the author's timezone when available
    let postAuthorProfile = null;
    try {
      if (post?.author_id) {
        postAuthorProfile = await (await import("./blogApi.js")).getAuthorProfile(post.author_id);
      }
    } catch {
      postAuthorProfile = null;
    }

    if (authorSpan) authorSpan.textContent = post?.is_anonymous ? "Anonymous" : (post?.display_name || "Member");
    if (dateSpan) {
      const tz = postAuthorProfile?.timezone || null;
      dateSpan.textContent =
        `Published: ${fmtDate(post.created_at, tz)}` + (post.status === "published" ? "" : " (DRAFT)");
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

        editPostBtn.onclick = async () => {
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

          // File input for adding attachments while editing
          const fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.multiple = true;
          fileInput.style.display = "block";
          fileInput.style.marginTop = "8px";
          fileInput.className = "input";

          const cancelBtn = document.createElement("button");
          cancelBtn.className = "btn btn-sm";
          cancelBtn.textContent = "Cancel";

          postControls.parentElement.appendChild(saveBtn);
          postControls.parentElement.appendChild(cancelBtn);
          postControls.parentElement.appendChild(fileInput);

          // Mark we're in edit mode so per-attachment delete controls appear
          editingPost = true;
          // Re-render attachments so delete buttons show while editing
          try { await renderFiles(post.id); } catch (e) { /* ignore render failures */ }

          saveBtn.onclick = async () => {
            try {
              saveBtn.disabled = true;
              await updatePost(post.id, { body: textarea.value || "" });

              // If files were selected, upload them and record DB entries
              try {
                if (fileInput.files && fileInput.files.length) {
                  const session = await getSession();
                  const authorId = session?.user?.id;
                  if (!authorId) throw new Error("Missing session for file upload.");
                  await uploadAndRecordFiles({ postId: post.id, authorId, files: Array.from(fileInput.files) });
                }
              } catch (fupe) {
                // If upload fails, re-enable and surface error
                saveBtn.disabled = false;
                alert(`File upload failed: ${fupe?.message || String(fupe)}`);
                return;
              }

              // reload page to refresh content, attachments and metadata
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