// js/write.js
import { getSession, getMyAuthorStatus } from "./auth.js";
import { createPost } from "./blogApi.js";
import { uploadAndRecordFiles } from "./uploader.js";

const $ = (id) => document.getElementById(id);
let currentAccountAnon = false;

function getForumSlug() {
  const u = new URL(window.location.href);
  return (u.searchParams.get("forum") || "general-topics").trim();
}

function setStatus(msg, isError = false) {
  const el = $("statusMsg");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("text-rose-300", !!isError);
  el.classList.toggle("text-slate-400", !isError);
}

function setHeaderForum(slug) {
  const el = $("postingIn") || $("forumSlugLabel");
  if (el) el.textContent = slug;
}

function disableForm(disabled) {
  const ids = ["title", "content", "anonToggle", "files", "publishBtn", "saveDraftBtn"];
  ids.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.disabled = !!disabled;
    el.classList.toggle("opacity-50", !!disabled);
    el.classList.toggle("cursor-not-allowed", !!disabled);
  });
}

function updateAnonNotice(accountAnon, localToggle) {
  const el = $("anonNotice");
  if (!el) return;
  const isAnon = !!accountAnon || !!localToggle;
  if (!isAnon) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  if (accountAnon && localToggle) {
    el.textContent = 'Your account is set to anonymous and this post will be anonymous.';
  } else if (accountAnon) {
    el.textContent = 'Your account is set to post anonymously; this post will be anonymous.';
  } else {
    el.textContent = 'This post will be anonymous.';
  }
}

async function requireApprovedAuthor() {
  try {
    const status = await getMyAuthorStatus(); // { ok, signed_in, approved, ... }
    if (!status?.ok && status?.signed_in !== false) {
      // If getMyAuthorStatus returned an error payload
      setStatus(`Unable to load author profile: ${status?.error || "Unknown error"}`, true);
      return null;
    }

    if (!status?.approved) {
      setStatus(
        "Read-only: your account is not approved to publish yet. You can browse forums, but you cannot post.",
        true
      );
      return status;
    }

    setStatus("");
    return status;
  } catch (e) {
    setStatus(`Unable to load author profile: ${String(e)}`, true);
    return null;
  }
}

async function handlePublish({ publish }) {
  const forum = getForumSlug();

  const title = ($("title")?.value || "").trim();
  const body = ($("content")?.value || "").trim();
  const isAnonymous = !!$("anonToggle")?.checked;

  if (!title || !body) {
    setStatus("Title and body are required.", true);
    return;
  }

  // attachments optional
  const files = $("files")?.files ? Array.from($("files").files) : [];

  setStatus(publish ? "Publishing..." : "Saving draft...");
  disableForm(true);

  try {
    const session = await getSession();
    if (!session?.user?.id) {
      setStatus("You must be signed in to publish.", true);
      disableForm(false);
      return;
    }

    // Add logging and a timeout wrapper to diagnose hangs seen with
    // certain post bodies (helps determine if createPost is pending).
    console.log("Publishing: starting createPost", {
      forum_slug: forum,
      titleLength: String(title || '').length,
      bodyLength: String(body || '').length,
      is_anonymous: !!isAnonymous,
    });

    const createPayload = {
      forum_slug: forum,
      title,
      body,
      author_id: session.user.id,
      status: publish ? "published" : "draft",
      is_anonymous: !!isAnonymous,
    };

    const timeoutMs = 15000;
    const createPromise = createPost(createPayload);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`createPost: timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    let data;
    try {
      data = await Promise.race([createPromise, timeoutPromise]);
    } catch (ce) {
      console.error("Publishing: createPost failed or timed out", ce);
      // Rethrow so outer catch will show the error in the UI and re-enable the form
      throw ce;
    }

    console.log("Publishing: createPost succeeded", data);

    // If there are attachments, upload and record them
    if (files.length) {
      try {
        await uploadAndRecordFiles({ postId: data.id, authorId: session.user.id, files });
      } catch (e) {
        // Non-fatal: record failure but allow navigation
        console.error("Attachment upload failed:", e);
      }
    }

    // Success: go back to the forum thread list
    setStatus(publish ? "Published." : "Draft saved.");
    window.location.href = `./forum.html?forum=${encodeURIComponent(forum)}`;
  } catch (e) {
    setStatus(e?.message || String(e) || "Publish failed.", true);
    disableForm(false);
    return;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const forum = getForumSlug();
  setHeaderForum(forum);

  const backLink = $("backLink");
  // Set shared header back button to return to the forum list
  const headerBack = document.getElementById("headerBack");
  if (headerBack) {
    headerBack.setAttribute("data-back-href", `./forum.html?forum=${encodeURIComponent(forum)}`);
    headerBack.style.display = "inline-flex";
  }

  // Ensure login sends user back to this page after authentication
  const loginLink = document.getElementById("loginLink");
  if (loginLink) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    loginLink.href = `./login.html?next=${next}`;
  }

  // Ensure form doesn't refresh the page
  // Buttons already wired below; attach save-draft button too
  const saveDraftBtn = $("saveDraftBtn");
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handlePublish({ publish: false });
    });
  }

  const publishBtn = $("publishBtn");
  if (publishBtn) {
    publishBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handlePublish({ publish: true });
    });
  }

  // Auth/approval gating
  disableForm(true);

  const session = await getSession();
  if (!session?.user) {
    setStatus("Please log in to create a thread.", true);
    return;
  }

  const authorStatus = await requireApprovedAuthor();
  if (!authorStatus || !authorStatus.approved) {
    // leave disabled
    return;
  }

  // Approved -> enable posting
  disableForm(false);

  // Track account anonymity and show anon notice
  try {
    currentAccountAnon = !!authorStatus?.is_anonymous;
    updateAnonNotice(currentAccountAnon, $("anonToggle")?.checked);
  } catch (e) {}

  // Wire local post anon toggle to update notice
  const localAnon = $("anonToggle");
  if (localAnon) {
    localAnon.onchange = () => updateAnonNotice(currentAccountAnon, !!localAnon.checked);
  }

  // Listen for global anonymity changes (dispatched by setMyAnonymity)
  try {
    window.addEventListener('anonymityChanged', (ev) => {
      try {
        const next = !!(ev && ev.detail && ev.detail.is_anonymous);
        currentAccountAnon = next;
        updateAnonNotice(currentAccountAnon, $("anonToggle")?.checked);
      } catch (e) {}
    });
  } catch (e) {}

  // Clear edit UI and redirect to index if the user signs out elsewhere
  try {
    window.addEventListener('signedOut', () => {
      try {
        disableForm(true);
        setStatus('Signed out. Redirecting...');
        window.location.href = './index.html';
      } catch (e) {}
    });
  } catch (e) {}

  // Wire custom file picker UI (keeps native #files input for upload)
  const filesInput = $("files");
  const filesBtn = $("filesBtn");
  const filesLabel = $("filesLabel");
  // Preview wiring: show a preview frame for selected files until hidden
  const filePreviewContainer = $("filePreviewContainer");
  const filePreview = $("filePreview");
  const hidePreviewBtn = $("hidePreviewBtn");
  let _previewUrls = [];

  function clearPreviews() {
    try {
      if (filePreview) filePreview.innerHTML = '';
      _previewUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
      _previewUrls = [];
    } catch (e) {}
  }

  async function renderPreviews(files) {
    clearPreviews();
    if (!filePreview) return;
    for (const file of files) {
      const type = file.type || '';
      const url = URL.createObjectURL(file);
      _previewUrls.push(url);

      // Images
      if (type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = url;
        img.className = 'file-preview-img';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        img.style.marginBottom = '8px';
        filePreview.appendChild(img);
        continue;
      }

      // PDFs: render first page using pdfjs when available
      if (type === 'application/pdf' || (file.name || '').toLowerCase().endsWith('.pdf')) {
        if (window.pdfjsLib) {
          try {
            const loadingTask = window.pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1 });
            const containerWidth = Math.min(760, filePreview.clientWidth || 760);
            const scale = Math.max(0.5, Math.min(1.2, (containerWidth / viewport.width) * 0.95));
            const vp = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = vp.width;
            canvas.height = vp.height;
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            canvas.style.maxWidth = '100%';
            canvas.style.borderRadius = '6px';
            canvas.style.marginBottom = '8px';
            filePreview.appendChild(canvas);
            continue;
          } catch (e) {
            // fallthrough to link fallback below
          }
        }
      }

      // Audio
      if (type.startsWith('audio/')) {
        const a = document.createElement('audio');
        a.controls = true;
        a.src = url;
        a.style.width = '100%';
        a.style.marginBottom = '8px';
        filePreview.appendChild(a);
        continue;
      }

      // Video
      if (type.startsWith('video/')) {
        const v = document.createElement('video');
        v.controls = true;
        v.src = url;
        v.style.maxWidth = '100%';
        v.style.borderRadius = '6px';
        v.style.marginBottom = '8px';
        filePreview.appendChild(v);
        continue;
      }

      // Fallback: show filename and download link
      const row = document.createElement('div');
      row.className = 'fileRow';
      const a = document.createElement('a');
      a.href = url;
      a.textContent = file.name || 'Unnamed file';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = file.name || '';
      row.appendChild(a);
      filePreview.appendChild(row);
    }
  }

  if (filesBtn && filesInput && filesLabel) {
    filesBtn.addEventListener('click', () => filesInput.click());
    filesInput.addEventListener('change', async () => {
      const files = filesInput.files ? Array.from(filesInput.files) : [];
      filesLabel.textContent = files.length ? files.map(f => f.name).join(', ') : 'No files selected.';
      if (files.length) {
        try {
          await renderPreviews(files);
          if (filePreviewContainer) filePreviewContainer.style.display = '';
        } catch (e) {
          console.error('Preview render failed', e);
        }
      } else {
        clearPreviews();
        if (filePreviewContainer) filePreviewContainer.style.display = 'none';
      }
    });
  }

  if (hidePreviewBtn) {
    hidePreviewBtn.addEventListener('click', () => {
      if (filePreviewContainer) filePreviewContainer.style.display = 'none';
    });
  }
});