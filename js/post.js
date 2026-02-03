// js/post.js
import { getPostById, listComments, addComment, listPostFiles, listCommentFiles, updateComment, deleteComment, updatePost, deletePost, deletePostFile, deleteCommentFile } from "./blogApi.js";
import { getPublicUrl } from "./storageApi.js";
import { getSupabaseClient } from "./supabaseClient.js";
import { getSession, wireAuthButtons, getMyAuthorStatus, setMyAnonymity } from "./auth.js";
import { uploadAndRecordFiles, uploadAndRecordCommentFiles } from "./uploader.js";
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
let commentFilesInput;

let anonNoticeEl;

// Handle anonymity toggle
let commentAnonPanel;
let commentAnonToggle;
let commentAnonStatus;
let editingPost = false;

// Detect mobile devices (simple UA sniff for pragmatic behavior)
const __isMobileDevice = (() => {
  try {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
  } catch (e) { return false; }
})();

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Convert plain-text containing URLs into a DOM element with anchors.
function createLinkifiedProse(text) {
  const container = document.createElement('div');
  container.className = 'prose';

  // Match URLs starting with http(s):// or www.
  const regex = /((?:https?:\/\/|www\.)[^\s<>]+)/g;
  let lastIndex = 0;
  text = String(text || '');
  let m;
  while ((m = regex.exec(text)) !== null) {
    const url = m[0];
    const before = text.slice(lastIndex, m.index);
    if (before) container.appendChild(document.createTextNode(before));

    // Normalize href (add scheme for www.)
    let href = url;
    if (href.startsWith('www.')) href = 'http://' + href;

    try {
      // If the link points to a known embeddable video (direct file or
      // popular providers like YouTube/Vimeo), replace the anchor with
      // an inline, lazy-loaded player that will autoplay (muted) when visible.
      const videoExtRE = /\.(mp4|webm|ogg|ogv|mov)(?:[?#].*)?$/i;
      const youTubeWatch = href.match(/(?:youtube\.com\/watch\?v=|youtube\.com\/.*[&?]v=)([A-Za-z0-9_-]{11})/i);
      const youTuBeShort = href.match(/(?:youtu\.be\/)([A-Za-z0-9_-]{11})/i);
      const vimeoMatch = href.match(/vimeo\.com\/(?:video\/)?(\d+)/i);

      if (videoExtRE.test(href)) {
        const vid = document.createElement('video');
        vid.controls = true;
        vid.className = 'linked-video prose-video';
        vid.style.maxWidth = '100%';
        vid.style.maxHeight = '480px';
        vid.textContent = 'Your browser does not support the video tag.';
        // Defer setting src until lazy load; use metadata preload to avoid eager download
        vid.preload = 'metadata';
        vid.__lazyLoad = () => { try { vid.src = href; observeMediaPlayback(vid); } catch (e) {} };
        vid.__startVisible = true;
        try { vid.__lazyLoad(); vid.__lazyLoaded = true; } catch (e) {}

        // Add a small caption link underneath so users can open the video directly
        const wrap = document.createElement('div');
        wrap.appendChild(vid);
        const caption = document.createElement('div');
        caption.className = 'muted';
        const a = document.createElement('a');
        a.href = href;
        a.textContent = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        caption.appendChild(a);
        wrap.appendChild(caption);
        container.appendChild(wrap);
      }
      // YouTube embed
      else if (youTubeWatch || youTuBeShort) {
        const vidId = (youTubeWatch && youTubeWatch[1]) || (youTuBeShort && youTuBeShort[1]);
        if (vidId) {
          const embed = `https://www.youtube.com/embed/${vidId}?autoplay=1&mute=1&rel=0&modestbranding=1`;
          const iframe = document.createElement('iframe');
          iframe.width = '560';
          iframe.height = '315';
          iframe.frameBorder = '0';
          iframe.allow = 'autoplay; picture-in-picture; fullscreen';
          iframe.allowFullscreen = true;
          iframe.className = 'linked-video-iframe';
          iframe.style.maxWidth = '100%';
          iframe.style.height = '360px';
          iframe.__lazyLoad = () => { try { iframe.src = embed; } catch (e) {} };
          iframe.__startVisible = true;
          try { iframe.__lazyLoad(); iframe.__lazyLoaded = true; } catch (e) {}

          const wrap = document.createElement('div');
          wrap.appendChild(iframe);
          const caption = document.createElement('div');
          caption.className = 'muted';
          const a = document.createElement('a');
          a.href = href;
          a.textContent = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          caption.appendChild(a);
          wrap.appendChild(caption);
          container.appendChild(wrap);
        } else {
          const a = document.createElement('a');
          a.href = href;
          a.textContent = url;
          try {
            const parsed = new URL(a.href, window.location.href);
            const host = (parsed.hostname || '').toLowerCase();
            if (!host.endsWith('allegationsofbribery.com')) {
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
            }
          } catch (e) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          }
          container.appendChild(a);
        }
      }
      // Vimeo embed
      else if (vimeoMatch) {
        const vidId = vimeoMatch[1];
        const embed = `https://player.vimeo.com/video/${vidId}?autoplay=1&muted=1`;
        const iframe = document.createElement('iframe');
        iframe.width = '640';
        iframe.height = '360';
        iframe.frameBorder = '0';
        iframe.allow = 'autoplay; fullscreen; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.className = 'linked-video-iframe';
        iframe.style.maxWidth = '100%';
        iframe.style.height = '360px';
        iframe.__lazyLoad = () => { try { iframe.src = embed; } catch (e) {} };
        iframe.__startVisible = true;
        try { iframe.__lazyLoad(); iframe.__lazyLoaded = true; } catch (e) {}

        const wrap = document.createElement('div');
        wrap.appendChild(iframe);
        const caption = document.createElement('div');
        caption.className = 'muted';
        const a = document.createElement('a');
        a.href = href;
        a.textContent = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        caption.appendChild(a);
        wrap.appendChild(caption);
        container.appendChild(wrap);
      }
      else {
        const a = document.createElement('a');
        a.href = href;
        a.textContent = url;

        // Same-site links should open in the same tab; external links open a new tab.
        try {
          const parsed = new URL(a.href, window.location.href);
          const host = (parsed.hostname || '').toLowerCase();
          if (!host.endsWith('allegationsofbribery.com')) {
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
          }
        } catch (e) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }

        container.appendChild(a);
      }
    } catch (e) {
      container.appendChild(document.createTextNode(url));
    }

    lastIndex = regex.lastIndex;
  }

  const rest = text.slice(lastIndex);
  if (rest) container.appendChild(document.createTextNode(rest));
  return container;
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
    }
    // Video playback in modal
    else if (mime && mime.startsWith('video/')) {
      const video = document.createElement('video');
      video.controls = true;
      video.src = url;
      video.className = 'file-modal-video';
      video.style.maxWidth = '100%';
      video.style.maxHeight = '80vh';
      video.setAttribute('aria-label', 'Video preview');
      content.appendChild(video);
      try { observeMediaPlayback(video); video.play && video.play().catch(() => {}); } catch (e) {}
    }
    else if (mime && mime.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = url;
      audio.className = 'file-modal-audio';
      audio.style.maxWidth = '100%';
      audio.setAttribute('aria-label', 'Audio preview');
      content.appendChild(audio);
      try { observeMediaPlayback(audio); audio.play && audio.play().catch(() => {}); } catch (e) {}
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
    // Pause any playing media in the modal before removing it
    try {
      const medias = __fileModal.content.querySelectorAll && __fileModal.content.querySelectorAll('video,audio');
      if (medias && medias.length) {
        medias.forEach(m => { try { m.pause && m.pause(); } catch (e) {} });
      }
    } catch (ee) {}
    __fileModal.overlay.remove();
    document.removeEventListener('keydown', __onFileModalKeydown);
    __fileModal = null;
    if (opener && typeof opener.focus === 'function') opener.focus();
  } catch (e) {
    __fileModal = null;
  }
}

// Media visibility helper: play when mostly in-view, pause otherwise.
const __mediaObservers = new WeakMap();
function observeMediaPlayback(el) {
  try {
    if (!el || !el.tagName) return;
    const t = el.tagName.toLowerCase();
    if (t !== 'video' && t !== 'audio') return;
    if (__mediaObservers.has(el)) return;
    const obs = new IntersectionObserver((entries) => {
      for (const ent of entries) {
        try {
          if (ent.intersectionRatio >= 0.75) {
            // Autoplay must be muted in many browsers; ensure muted before
            // attempting to play. Users can unmute manually.
            try { el.muted = true; } catch (e) {}
            el.play && el.play().catch(() => {});
          } else {
            el.pause && el.pause();
          }
        } catch (e) {}
      }
    }, { threshold: [0.75] });
    obs.observe(el);
    __mediaObservers.set(el, obs);
  } catch (e) {}
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
  const raw = u.searchParams.get("id") || "";
  // If the value contains a UUID (copied from text and may have trailing punctuation), return that.
  const m = raw.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (m) return m[0];
  // Fallback: trim whitespace and trailing punctuation like '.', ',', ';', ':'
  return raw.trim().replace(/[.,;:]+$/g, "");
}

async function renderFiles(postId) {
  if (!attachments) return;
  console.log('renderFiles called for postId=', postId);
  attachments.innerHTML = "";
  const files = await listPostFiles(postId);
  console.log('found files:', files && files.length);

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
    // If bucket/object_path are not provided (anonymous view), do not
    // attempt to build a public URL. The `public_post_files` view intentionally
    // omits storage paths for anon clients; show a sign-in prompt instead.
    let url = null;
    if (f.bucket && f.object_path) {
      url = await getPublicUrl(f.bucket, f.object_path);
    }
    const el = document.createElement("div");
    el.className = "item";
    if (url) {
      // Do not show filename/link inline; reveal filename & metadata via Info
      el.innerHTML = `
      <div class="muted small">Attachment available</div>
      <div class="file-info muted" style="display:none; margin-top:6px;">${escapeHtml(f.original_name)} • ${escapeHtml(f.mime_type || "file")} • ${escapeHtml(fmtDate(f.created_at))}</div>
    `;
    } else {
      // For anonymous users the storage path is hidden. Keep only sign-in prompt; filename in Info
      el.innerHTML = `
      <div class="muted small">Attachment available</div>
      <div class="file-info muted" style="display:none; margin-top:6px;">${escapeHtml(f.original_name)} • ${escapeHtml(f.mime_type || "file")} • ${escapeHtml(fmtDate(f.created_at))}</div>
      <div class="mt-2 text-xs text-slate-400">Sign in to view or download attachments.</div>
    `;
    }

      // Add explicit preview/download controls so mobile users can choose.
      const controls = document.createElement('div');
      controls.style.marginTop = '8px';

      // Determine if this is media: we hide download/open controls for media
      const _mime = (f.mime_type || '').toLowerCase();
      const _isMedia = _mime.startsWith('video/') || _mime.startsWith('audio/');

      // Add Info button to toggle file metadata visibility
      const infoBtn = document.createElement('button');
      infoBtn.className = 'btn btn-sm';
      infoBtn.style.marginRight = '8px';
      infoBtn.textContent = 'Info';
      infoBtn.onclick = (e) => {
        e.preventDefault();
        const info = el.querySelector('.file-info');
        if (!info) return;
        info.style.display = (info.style.display === 'none' || !info.style.display) ? 'block' : 'none';
      };
      controls.appendChild(infoBtn);

      if (!_isMedia) {
        if (!__isMobileDevice) {
          const previewBtn = document.createElement('button');
          previewBtn.className = 'btn btn-sm';
          previewBtn.textContent = 'Preview in New Tab';
          previewBtn.onclick = (e) => {
            e.preventDefault();
            if (url) window.open(url, '_blank', 'noopener');
          };
          controls.appendChild(previewBtn);
        }

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-sm';
        downloadBtn.style.marginLeft = '8px';
        downloadBtn.textContent = 'Download';
        downloadBtn.onclick = async (e) => {
          e.preventDefault();
          try {
            downloadBtn.disabled = true;
            const prevText = downloadBtn.textContent;
            downloadBtn.textContent = 'Downloading…';

            const resp = await fetch(url);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = f.original_name || 'file';
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);

            downloadBtn.textContent = prevText;
            downloadBtn.disabled = false;
          } catch (err) {
            downloadBtn.disabled = false;
            downloadBtn.textContent = 'Download';
            // fallback: open in new tab
            window.open(url, '_blank', 'noopener');
          }
        };
            controls.appendChild(downloadBtn);
      }

      el.appendChild(controls);

    // Add preview area (shown by default) with a hide/show toggle
    const previewWrap = document.createElement("div");
    previewWrap.style.marginTop = "6px";

    const mime = (f.mime_type || "").toLowerCase();

    const makeToggle = (targetEl, showText = "Hide preview", hideText = "Show preview") => {
      const btn = document.createElement("button");
      btn.className = "btn btn-sm";
      // Start previews hidden by default. If the element sets
      // `__startVisible = true`, leave it visible and set the
      // button to the 'Hide preview' state immediately.
      try {
        if (targetEl && targetEl.__startVisible) {
          targetEl.style.display = "block";
          btn.textContent = showText;
        } else {
          targetEl.style.display = "none";
          btn.textContent = hideText;
        }
      } catch (e) {}
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
          // If the revealed element is audio/video, attach visibility observer,
          // focus and attempt to play.
          try {
            const tn = (targetEl && targetEl.tagName || '').toLowerCase();
            if (tn === 'video' || tn === 'audio') {
              try { observeMediaPlayback(targetEl); } catch (e) {}
              try { targetEl.tabIndex = 0; } catch (e) {}
              try { targetEl.focus && targetEl.focus(); } catch (e) {}
              try { targetEl.play && targetEl.play().catch(() => {}); } catch (e) {}
            }
          } catch (ee) {}
        } else {
          // If media, pause when hiding
          try {
            const tn = (targetEl && targetEl.tagName || '').toLowerCase();
            if (tn === 'video' || tn === 'audio') {
              try { targetEl.pause && targetEl.pause(); } catch (e) {}
            }
          } catch (ee) {}
          targetEl.style.display = "none";
          btn.textContent = hideText;
        }
      };
      return btn;
    };

    // Videos: create an inline, lazy-loaded preview so users can play directly
    // Do not create inline previews for images or PDFs to avoid mobile
    // browsers treating the resource as a download. Keep only the anchor
    // at the top which opens the file in a new tab.
    if (mime && mime.startsWith("video/")) {
      const vid = document.createElement('video');
      vid.controls = true;
      vid.style.maxWidth = '100%';
      vid.style.maxHeight = '480px';
      vid.className = 'file-video';
      vid.textContent = 'Your browser does not support the video tag.';

      if (url) {
        // Defer setting the src until user requests the preview (lazy load)
        vid.__lazyLoad = () => { vid.src = url; try { observeMediaPlayback(vid); } catch (e) {} };
        // Start visible so it can autoplay when in view without an extra click
        vid.__startVisible = true;
        // Fire lazy load immediately so observer is attached and src set
        try { vid.__lazyLoad(); vid.__lazyLoaded = true; } catch (e) {}
      } else {
        const note = document.createElement('div');
        note.className = 'muted';
        note.textContent = 'Preview unavailable.';
        previewWrap.appendChild(note);
      }

      previewWrap.appendChild(makeToggle(vid, 'Hide preview', 'Show preview'));
      previewWrap.appendChild(vid);
    } else if (mime && (mime.startsWith("image/") || mime === "application/pdf")) {
      // Inline preview for images and PDFs — auto-show until hidden
      try {
        if (mime.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = url;
          img.alt = f.original_name || '';
          img.style.maxWidth = '100%';
          img.style.borderRadius = '6px';
          img.className = 'file-inline-image';
          img.__startVisible = true;
          previewWrap.appendChild(makeToggle(img, 'Hide preview', 'Show preview'));
          previewWrap.appendChild(img);
        } else if (mime === 'application/pdf') {
          // Try to render first page with pdfjs if available
          if (window.pdfjsLib) {
            try {
              const loadingTask = window.pdfjsLib.getDocument(url);
              const pdf = await loadingTask.promise;
              const page = await pdf.getPage(1);
              const viewport = page.getViewport({ scale: 1 });
              const containerWidth = Math.min(760, previewWrap.clientWidth || 760);
              const scale = Math.max(0.6, Math.min(1.2, (containerWidth / viewport.width) * 0.95));
              const vp = page.getViewport({ scale });
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = vp.width;
              canvas.height = vp.height;
              await page.render({ canvasContext: ctx, viewport: vp }).promise;
              canvas.style.maxWidth = '100%';
              canvas.style.borderRadius = '6px';
              canvas.__startVisible = true;
              previewWrap.appendChild(makeToggle(canvas, 'Hide preview', 'Show preview'));
              previewWrap.appendChild(canvas);
            } catch (e) {
              // fallback to iframe if pdfjs render fails
              const iframe = document.createElement('iframe');
              iframe.src = url;
              iframe.className = 'file-modal-iframe';
              iframe.style.width = '100%';
              iframe.style.height = '480px';
              iframe.__startVisible = true;
              previewWrap.appendChild(makeToggle(iframe, 'Hide preview', 'Show preview'));
              previewWrap.appendChild(iframe);
            }
          } else {
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.className = 'file-modal-iframe';
            iframe.style.width = '100%';
            iframe.style.height = '480px';
            iframe.__startVisible = true;
            previewWrap.appendChild(makeToggle(iframe, 'Hide preview', 'Show preview'));
            previewWrap.appendChild(iframe);
          }
        }
      } catch (e) {
        // ignore preview errors and leave only the anchor/controls
        console.error('inline preview error', e);
      }
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

    // If current user is the post author, show delete control per attachment
    if (isPostAuthor) {
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
    // Let anchor links behave normally (open in a new tab via target="_blank").

    el.appendChild(previewWrap);
    attachments.appendChild(el);
  }

  // If author, allow adding more attachments below the list
  if (isPostAuthor) attachments.appendChild(makeUploadUi());
}

// Render an author badge under the post body showing optional registration
// fields (credentials, union affiliation, bio, etc.). Hide for anonymous
// posts or when no profile info is available.
function getFirstProfileValue(profile, keys) {
  if (!profile) return null;
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(profile, k)) continue;
    const val = profile[k];
    if (val == null) continue;
    if (typeof val === 'string') {
      const t = val.trim();
      if (t) return t;
    } else if (val) {
      return val;
    }
  }
  return null;
}

function renderAuthorBadge(post, profile) {
  const badge = document.getElementById('authorBadge');
  if (!badge) return;
  try {
    if (!post || post.is_anonymous || !post.author_id) {
      badge.style.display = 'none';
      return;
    }

    // Candidate fields collected from the authors table (deployments may
    // store different names — check common alternatives).
    const credentials = getFirstProfileValue(profile, ['credentials', 'credential', 'professional', 'title']);
    const unionAff = getFirstProfileValue(profile, ['union_affiliation', 'union', 'union_aff']);
    const organization = getFirstProfileValue(profile, ['organization', 'employer', 'org']);
    const bio = getFirstProfileValue(profile, ['bio', 'about', 'summary']);

    const parts = [];
    if (credentials) parts.push(`<div>${escapeHtml(credentials)}</div>`);
    if (unionAff) parts.push(`<div>${escapeHtml(unionAff)}</div>`);
    if (organization) parts.push(`<div>${escapeHtml(organization)}</div>`);
    if (bio) parts.push(`<div class="muted" style="margin-top:6px">${escapeHtml(bio)}</div>`);

    if (!parts.length) {
      // Nothing to show — keep hidden
      badge.style.display = 'none';
      badge.innerHTML = '';
      return;
    }

    badge.innerHTML = `
      <div style="margin-top:8px">${parts.join('')}</div>
    `;
    badge.style.display = '';
  } catch (e) {
    // On error, hide badge silently
    try { badge.style.display = 'none'; } catch (ee) {}
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
  // Cache author profiles to avoid repeated network calls
  const authorProfiles = new Map();
  const currentUserId = session?.user?.id || null;
  // Build a tree of comments (parent_id -> children)
  // Normalize ids to strings to avoid type mismatches between numeric/string ids
  const byId = new Map();
  for (const c of comments) {
    c.children = [];
    byId.set(String(c.id), c);
  }
  const roots = [];
  for (const c of comments) {
    const pid = c.parent_id ? String(c.parent_id) : null;
    if (pid && byId.has(pid)) {
      byId.get(pid).children.push(c);
    } else {
      roots.push(c);
    }
  }

  const renderNode = async (c, depth = 0, container = commentsEl) => {
    const el = document.createElement("div");
    el.className = "item";
    el.style.marginLeft = `${depth * 18}px`;
    if (depth > 0) el.classList.add('reply');
    const commenter = c.is_anonymous ? "Anonymous" : (c.display_name || "Member");

    const isReply = depth > 0;
    // Only show the inline "Reply" label for replies when a user is signed in.
    const showReplyLabel = isReply && !!currentUserId;
    el.innerHTML = `
      <div class="muted"><b>${escapeHtml(commenter)}</b> ${showReplyLabel ? '<span class="reply-label">Reply</span>' : ''} • ${escapeHtml(fmtDate(c.created_at))}</div>
    `;
    const bodyEl = createLinkifiedProse(c.body || '');
    bodyEl.style.marginTop = '8px';
    bodyEl.style.whiteSpace = 'pre-wrap';
    el.appendChild(bodyEl);

    // Determine whether current user can manage this comment (used by file controls)
    const canManage = !!currentUserId && (
      (c.author_id && currentUserId === c.author_id) ||
      (post.author_id && currentUserId === post.author_id)
    );

    // Render any files attached to this comment
    try {
      const commentFiles = await listCommentFiles(c.id);
      if (commentFiles && commentFiles.length) {
        const filesWrap = document.createElement('div');
        filesWrap.style.marginTop = '8px';
        filesWrap.className = 'comment-files';

        for (const f of commentFiles) {
          const url = await getPublicUrl(f.bucket, f.object_path);
          const fileEl = document.createElement('div');
          fileEl.className = 'muted';
          fileEl.style.marginTop = '6px';
          // Show a small visible placeholder so user can confirm attachments exist
          if (url) {
            fileEl.innerHTML = `<div class="muted small">Attachment available</div><div class="file-info muted" style="display:none; margin-top:6px;">${escapeHtml(f.original_name)} • ${escapeHtml(f.mime_type || "file")} • ${escapeHtml(fmtDate(f.created_at))}</div>`;
          } else {
            fileEl.innerHTML = `<div class="muted small">Attachment available</div><div class="file-info muted" style="display:none; margin-top:6px;">${escapeHtml(f.original_name)} • ${escapeHtml(f.mime_type || "file")} • ${escapeHtml(fmtDate(f.created_at))}</div>`;
          }

          const ctrls = document.createElement('div');
          ctrls.style.marginTop = '6px';

          // Info toggle for comment file metadata
          const infoBtn = document.createElement('button');
          infoBtn.className = 'btn btn-sm';
          infoBtn.style.marginRight = '8px';
          infoBtn.textContent = 'Info';
          infoBtn.onclick = (e) => {
            e.preventDefault();
            const info = fileEl.querySelector('.file-info');
            if (!info) return;
            info.style.display = (info.style.display === 'none' || !info.style.display) ? 'block' : 'none';
          };
          ctrls.appendChild(infoBtn);

          const _cmime = (f.mime_type || '').toLowerCase();
          const _cisMedia = _cmime.startsWith('video/') || _cmime.startsWith('audio/');

          if (_cisMedia) {
            // Inline media preview for comment attachments. No download/preview
            // buttons are shown for audio/video — use the toggle to start/stop.
            const mediaTag = _cmime.startsWith('video/') ? 'video' : 'audio';
            const mediaEl = document.createElement(mediaTag);
            mediaEl.controls = true;
            mediaEl.style.maxWidth = '100%';
            mediaEl.className = 'comment-file-media';
            mediaEl.textContent = 'Your browser does not support this media type.';
            if (url) {
              mediaEl.__lazyLoad = () => { mediaEl.src = url; try { observeMediaPlayback(mediaEl); } catch (e) {} };
              // Start visible so comment media can autoplay when in view
              mediaEl.__startVisible = true;
              try { mediaEl.__lazyLoad(); mediaEl.__lazyLoaded = true; } catch (e) {}
              fileEl.appendChild(makeToggle(mediaEl, 'Hide preview', 'Show preview'));
              fileEl.appendChild(mediaEl);
            } else {
              const note = document.createElement('div');
              note.className = 'muted';
              note.textContent = 'Preview unavailable.';
              fileEl.appendChild(note);
            }
          } else {
            if (!__isMobileDevice) {
              const previewBtn = document.createElement('button');
              previewBtn.className = 'btn btn-sm';
              previewBtn.textContent = 'Preview';
              previewBtn.onclick = (e) => { e.preventDefault(); showFileModal(url, (f.mime_type || '').toLowerCase(), previewBtn); };
              ctrls.appendChild(previewBtn);
            }

            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'btn btn-sm';
            downloadBtn.style.marginLeft = '8px';
            downloadBtn.textContent = 'Download';
            downloadBtn.onclick = async (e) => {
              e.preventDefault();
              try {
                downloadBtn.disabled = true;
                const prev = downloadBtn.textContent;
                downloadBtn.textContent = 'Downloading…';
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const blob = await resp.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = f.original_name || 'file';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(blobUrl);
                downloadBtn.textContent = prev;
                downloadBtn.disabled = false;
              } catch (err) {
                downloadBtn.disabled = false;
                downloadBtn.textContent = 'Download';
                window.open(url, '_blank', 'noopener');
              }
            };
            ctrls.appendChild(downloadBtn);
          }

          if (canManage) {
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-sm btn-danger';
            delBtn.style.marginLeft = '8px';
            delBtn.textContent = 'Delete file';
            delBtn.onclick = async () => {
              if (!confirm('Delete this attachment? This will remove the file and its record.')) return;
              try {
                delBtn.disabled = true;
                await deleteCommentFile(f.id);
                await renderComments(post);
              } catch (e) {
                delBtn.disabled = false;
                alert(`Delete failed: ${e?.message || String(e)}`);
              }
            };
            ctrls.appendChild(delBtn);
          }

          fileEl.appendChild(ctrls);
          filesWrap.appendChild(fileEl);
        }

        el.appendChild(filesWrap);
      }
    } catch (e) {
      // ignore file rendering errors
      console.error('comment files render error', e);
    }

    const ctrl = document.createElement("div");
    ctrl.style.marginTop = "6px";
    // Always attach the control container so buttons added later (Reply)
    // are visible even when the current user cannot edit/delete.
    el.appendChild(ctrl);

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

    // Render compact author badge for this comment if the commenter is a registered author
    try {
      if (!c.is_anonymous && c.author_id) {
        let profile = authorProfiles.get(c.author_id);
        if (profile === undefined) {
          try {
            profile = await (await import("./blogApi.js")).getAuthorProfile(c.author_id);
          } catch (pe) {
            profile = null;
          }
          authorProfiles.set(c.author_id, profile);
        }

        if (profile) {
          const credentials = getFirstProfileValue(profile, ['credentials', 'credential', 'professional', 'title']);
          const unionAff = getFirstProfileValue(profile, ['union_affiliation', 'union', 'union_aff']);
          const organization = getFirstProfileValue(profile, ['organization', 'employer', 'org']);
          const bio = getFirstProfileValue(profile, ['bio', 'about', 'summary']);

          const parts = [];
          if (credentials) parts.push(`<div>${escapeHtml(credentials)}</div>`);
          if (unionAff) parts.push(`<div>${escapeHtml(unionAff)}</div>`);
          if (organization) parts.push(`<div>${escapeHtml(organization)}</div>`);
          if (bio) parts.push(`<div class="muted" style="margin-top:6px">${escapeHtml(bio)}</div>`);

          if (parts.length) {
            const badgeDiv = document.createElement('div');
            badgeDiv.className = 'card author-badge';
            badgeDiv.style.marginTop = '8px';
            badgeDiv.innerHTML = parts.join('');
            el.appendChild(badgeDiv);
          }
        }
      }
    } catch (e) {
      // ignore profile render failures
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

        // Inline notice for reply boxes when account anonymity is enabled
        (async () => {
          try {
            const st = await getMyAuthorStatus();
            if (st?.is_anonymous) {
              const note = document.createElement('p');
              note.className = 'anon-notice small';
              note.textContent = 'Replies will be posted anonymously.';
              note.style.marginTop = '6px';
              el.appendChild(note);
            }
          } catch (e) {}
        })();

        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-sm';
        saveBtn.textContent = 'Reply';
        saveBtn.style.marginTop = '6px';
        saveBtn.style.marginRight = '6px';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-sm';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.marginTop = '6px';

        // File input for reply attachments
        const replyFileInput = document.createElement('input');
        replyFileInput.type = 'file';
        replyFileInput.multiple = true;
        replyFileInput.className = 'input';
        replyFileInput.style.display = 'block';
        replyFileInput.style.marginTop = '6px';

        el.appendChild(textarea);
        el.appendChild(replyFileInput);
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
            const added = await addComment(post.id, body, displayName, isAnon, myUserId, c.id);
            try {
              if (replyFileInput && replyFileInput.files && replyFileInput.files.length) {
                const cid = added?.id;
                if (cid) {
                  await uploadAndRecordCommentFiles({ commentId: cid, authorId: myUserId, files: Array.from(replyFileInput.files) });
                }
              }
            } catch (fupe) {
              // non-fatal; inform user
              alert(`Reply posted but file upload failed: ${fupe?.message || String(fupe)}`);
            }
            await renderComments(post);
          } catch (e) {
            saveBtn.disabled = false;
            alert(`Reply failed: ${e?.message || String(e)}`);
          }
        };

        cancelBtn.onclick = () => {
          const box = el.querySelector('.reply-box');
          if (box) box.remove();
          const note = el.querySelector('.anon-notice.small');
          if (note) note.remove();
          saveBtn.remove();
          cancelBtn.remove();
        };
      };
      ctrl.appendChild(replyBtn);
    }

    // Attach rendered node to provided container
    container.appendChild(el);

    // If there are children, create a collapsible container and an arrow toggle.
    if (c.children && c.children.length) {
      try {
        const headerDiv = el.firstElementChild || el.querySelector('div');
        // Small inline text toggle (not a button) that stays inside the comment box
        const arrowBtn = document.createElement('span');
        arrowBtn.className = 'reply-toggle-text';
        arrowBtn.setAttribute('role', 'button');
        const _count = (c.children && c.children.length) ? c.children.length : 0;
        // Render as inline text with arrow glyph and label
        arrowBtn.setAttribute('aria-expanded', 'false');
        arrowBtn.title = `Show ${_count} ${_count === 1 ? 'reply' : 'replies'}`;
        try {
          const lbl = `${_count} ${_count === 1 ? 'Reply' : 'Replies'}`;
          arrowBtn.innerHTML = `<span class="reply-toggle-icon">▶</span><span class="reply-toggle-label" style="margin-left:6px">${lbl}</span>`;
        } catch (e) {
          arrowBtn.textContent = `${_count} ${_count === 1 ? 'Reply' : 'Replies'}`;
        }
        arrowBtn.style.cursor = 'pointer';
        arrowBtn.style.fontSize = '0.95rem';
        // Right-justify: make the header a flex container and append the button
        if (headerDiv) {
          try {
            // Build a new header container so we don't mutate the original
            // element unexpectedly (which caused layout/overflow issues).
            const hdr = document.createElement('div');
            hdr.style.display = 'flex';
            hdr.style.justifyContent = 'space-between';
            hdr.style.alignItems = 'center';

            const leftWrap = document.createElement('div');
            leftWrap.style.flex = '1 1 auto';
            // Move existing header content into the left wrapper
            while (headerDiv.firstChild) leftWrap.appendChild(headerDiv.firstChild);

            // Prevent label wrapping and keep it inline inside the left column
            try {
              arrowBtn.style.whiteSpace = 'nowrap';
              arrowBtn.style.display = 'inline-flex';
              arrowBtn.style.alignItems = 'center';
              arrowBtn.style.marginLeft = '12px';
            } catch (e) {}

            leftWrap.appendChild(arrowBtn);
            hdr.appendChild(leftWrap);
            // Replace the old headerDiv with our new structured header
            headerDiv.replaceWith(hdr);
          } catch (e) {}
        }

        const childrenWrap = document.createElement('div');
        childrenWrap.className = 'comment-children';
        childrenWrap.style.display = 'none';
        el.appendChild(childrenWrap);

        arrowBtn.onclick = async () => {
          const count = (c.children && c.children.length) ? c.children.length : 0;
          if (childrenWrap.style.display === 'none') {
            // Render children into the collapsible container if not already
            if (!childrenWrap.hasChildNodes()) {
              for (const child of c.children) {
                await renderNode(child, depth + 1, childrenWrap);
              }
            }
            childrenWrap.style.display = '';
            arrowBtn.setAttribute('aria-expanded', 'true');
            arrowBtn.title = `Hide ${count} ${count === 1 ? 'reply' : 'replies'}`;
            try {
              arrowBtn.innerHTML = `<span class="reply-toggle-icon">▾</span><span class="reply-toggle-label" style="margin-left:6px">Hide ${count} ${count === 1 ? 'Reply' : 'Replies'}</span>`;
            } catch (e) {
              arrowBtn.textContent = `Hide ${count} ${count === 1 ? 'Reply' : 'Replies'}`;
            }
          } else {
            childrenWrap.style.display = 'none';
            arrowBtn.setAttribute('aria-expanded', 'false');
            arrowBtn.title = `Show ${count} ${count === 1 ? 'reply' : 'replies'}`;
            try {
              arrowBtn.innerHTML = `<span class="reply-toggle-icon">▶</span><span class="reply-toggle-label" style="margin-left:6px">${count} ${count === 1 ? 'Reply' : 'Replies'}</span>`;
            } catch (e) {
              arrowBtn.textContent = `${count} ${count === 1 ? 'Reply' : 'Replies'}`;
            }
          }
        };
      } catch (e) {
        // ignore
      }
    }
  };

  for (const r of roots) await renderNode(r, 0);
}

async function wireCommentForm(post) {

  const session = await getSession();

  // Logged out: disable comment form + hide anon toggle UI
  if (!session) {
      if (commentGate) {
        commentGate.textContent = "To comment, please log in.";
        try { commentGate.style.color = 'var(--danger)'; } catch (e) {}
      }

    // Hide the whole comment input area when not signed in
    try { document.querySelector('label[for="commentText"]').style.display = 'none'; } catch (e) {}
    if (commentText) commentText.style.display = 'none';
    if (commentBtn) commentBtn.style.display = 'none';
    const checkBtn = document.getElementById('checkCommentBtn');
    if (checkBtn) checkBtn.style.display = 'none';
    if (commentAnonPanel) commentAnonPanel.style.display = 'none';
    return;
  }

  // Logged out: hide comment input area completely
  if (!session) {
    try { document.querySelector('label[for="commentText"]').style.display = 'none'; } catch (e) {}
    if (commentText) commentText.style.display = 'none';
    if (commentBtn) commentBtn.style.display = 'none';
    const checkBtn = document.getElementById('checkCommentBtn');
    if (checkBtn) checkBtn.style.display = 'none';
    if (commentAnonPanel) commentAnonPanel.style.display = 'none';
    return;
  }

  // Logged in: show and enable comment UI
  try { document.querySelector('label[for="commentText"]').style.display = ''; } catch (e) {}
  if (commentText) { commentText.style.display = ''; commentText.disabled = false; }
  if (commentBtn) { commentBtn.style.display = ''; commentBtn.disabled = false; }
  // Add file input for comment attachments when signed in
  try {
    const wrap = document.getElementById('commentFormWrap');
    if (wrap && !document.getElementById('commentFilesInput')) {
      commentFilesInput = document.createElement('input');
      commentFilesInput.type = 'file';
      // Accept media (video/audio) in addition to images/docs
      commentFilesInput.accept = '.pdf,.doc,.docx,.txt,image/*,video/*,audio/*';
      commentFilesInput.multiple = true;
      commentFilesInput.id = 'commentFilesInput';
      commentFilesInput.className = 'input';
      commentFilesInput.style.display = 'block';
      commentFilesInput.style.marginTop = '8px';
      wrap.appendChild(commentFilesInput);

      // Preflight bucket check
      (async () => {
        try {
          const sessionNow = await getSession();
          const currentUserId = sessionNow?.user?.id || null;
          if (!currentUserId) {
            commentFilesInput.disabled = true;
            return;
          }
          const ok = await bucketExists(POST_UPLOADS_BUCKET);
          if (!ok) {
            commentFilesInput.disabled = true;
          }
        } catch (e) {
          commentFilesInput.disabled = true;
        }
      })();
    }
  } catch (e) {}
  const checkBtn = document.getElementById('checkCommentBtn');
  if (checkBtn) checkBtn.style.display = '';
  if (commentAnonPanel) commentAnonPanel.style.display = '';
  if (commentAnonToggle) commentAnonToggle.disabled = false;
  // Initialize comment anonymity UI from account status and update visible notice
  try {
    const st = await getMyAuthorStatus();
    if (commentAnonToggle) commentAnonToggle.checked = !!st?.is_anonymous;
    if (commentAnonStatus) commentAnonStatus.textContent = st?.is_anonymous ? 'Anonymity is ON for your account.' : 'Anonymity is OFF for your account.';
    if (anonNoticeEl) {
      if (st?.is_anonymous) {
        anonNoticeEl.style.display = '';
        anonNoticeEl.textContent = 'Your account is set to post comments anonymously.';
      } else {
        anonNoticeEl.style.display = 'none';
      }
    }
  } catch (e) {}
  // Listen for global anonymity changes and update UI immediately
  try {
    window.addEventListener('anonymityChanged', (ev) => {
      try {
        const next = !!(ev && ev.detail && ev.detail.is_anonymous);
        if (commentAnonToggle) commentAnonToggle.checked = next;
        if (commentAnonStatus) commentAnonStatus.textContent = next ? 'Anonymity is ON for your account.' : 'Anonymity is OFF for your account.';
        if (anonNoticeEl) {
          if (next) {
            anonNoticeEl.style.display = '';
            anonNoticeEl.textContent = 'Your account is set to post comments anonymously.';
          } else {
            anonNoticeEl.style.display = 'none';
          }
        }
      } catch (e) {}
    });
  } catch (e) {}
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
        if (anonNoticeEl) {
          if (next) {
            anonNoticeEl.style.display = '';
            anonNoticeEl.textContent = 'Your account is set to post comments anonymously.';
          } else {
            anonNoticeEl.style.display = 'none';
          }
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
        commentBtn.disabled = true;
        if (commentMsg) commentMsg.textContent = 'Posting...';
        const body = (commentText?.value || '').trim();
        if (!body) {
          alert('Comment cannot be empty.');
          commentBtn.disabled = false;
          return;
        }

        const status = await getMyAuthorStatus();
        const isAnon = !!status?.is_anonymous;
        const displayName = status?.display_name || null;
        const myUserId = status?.user_id || null;

        const added = await addComment(post.id, body, displayName, isAnon, myUserId);

        try {
          if (commentFilesInput && commentFilesInput.files && commentFilesInput.files.length) {
            const cid = added?.id;
            if (cid) {
              await uploadAndRecordCommentFiles({ commentId: cid, authorId: myUserId, files: Array.from(commentFilesInput.files) });
            }
            // Clear selected files
            try { commentFilesInput.value = null; } catch (e) {}
          }
        } catch (fupe) {
          // Non-fatal: inform user but continue
          if (commentMsg) commentMsg.textContent = `Posted (file upload failed: ${fupe?.message || String(fupe)})`;
        }

        if (commentText) commentText.value = "";
        if (commentMsg) commentMsg.textContent = "Posted.";
        await renderComments(post);
      } catch (e) {
        if (commentMsg) commentMsg.textContent = `Error: ${e?.message || String(e)}`;
        commentBtn.disabled = false;
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
  anonNoticeEl = document.getElementById("anonNotice");

  await wireAuthButtons({ loginLinkId: "loginLink", logoutBtnId: "logoutBtn" });

  // Clear editing state when the user signs out so no edit UI remains visible
  try {
    window.addEventListener('signedOut', () => {
      try {
        editingPost = false;
        // Disable any contentEditable elements
        document.querySelectorAll('[contenteditable="true"]').forEach(el => {
          try { el.contentEditable = 'false'; } catch (e) {}
        });
        // Re-render files/comments to remove author-only controls
        const id = getId();
        if (id) {
          try { renderFiles(id).catch(() => {}); } catch (e) {}
          try { renderComments({ id }).catch(() => {}); } catch (e) {}
        }
      } catch (e) {}
    });
  } catch (e) {}

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

    // body is plain text in your schema; render safely and linkify URLs
    if (postContent) {
      postContent.innerHTML = "";
      const postBody = createLinkifiedProse(post.body || "");
      postBody.id = "postBody";
      postBody.style.whiteSpace = 'pre-wrap';
      postBody.style.lineHeight = '1.6';
      postContent.appendChild(postBody);
      // Render author badge (if any) after the body is inserted
      try { renderAuthorBadge(post, postAuthorProfile); } catch (e) { /* ignore */ }
    }

    // Increment view count (best-effort). Limit increments to once per hour
    // per client to reduce spammy repeated increments on refresh.
    (async () => {
      try {
        const id = getId();
        if (!id) return;
        const key = `viewed_post_${id}`;
        const raw = localStorage.getItem(key);
        const last = raw ? Number(raw) : 0;
        const now = Date.now();
        const HOUR = 1000 * 60 * 60;
        if (now - last < HOUR) return; // already counted recently

        const sb = getSupabaseClient();
        try {
          let resp;
          try {
            resp = await sb.rpc('increment_post_view', { p_post_id: id });
            console.debug('increment_post_view ok:', resp);
            localStorage.setItem(key, String(now));
          } catch (e1) {
            console.warn('increment_post_view failed (p_post_id):', e1?.message || e1);
            // Try alternative param name in case the DB or client expects a different key
            try {
              resp = await sb.rpc('increment_post_view', { post_id: id });
              console.debug('increment_post_view ok (post_id):', resp);
              localStorage.setItem(key, String(now));
            } catch (e2) {
              console.warn('increment_post_view failed (post_id):', e2?.message || e2);
              // Try positional argument as a last resort
              try {
                resp = await sb.rpc('increment_post_view', id);
                console.debug('increment_post_view ok (positional):', resp);
                localStorage.setItem(key, String(now));
              } catch (e3) {
                console.error('increment_post_view all attempts failed:', e3?.message || e3);
              }
            }
          }
        } catch (e) {
          console.error('increment_post_view unexpected error:', e?.message || e);
        }
      } catch (e) {}
    })();

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

          // Also allow editing the title inline. Replace the visible title
          // element with a text input so authors can change the thread title.
          let titleInput = null;
          try {
            const titleEl = document.getElementById('postTitle');
            if (titleEl) {
              titleInput = document.createElement('input');
              titleInput.className = 'input';
              titleInput.style.width = '100%';
              titleInput.style.marginBottom = '8px';
              titleInput.value = post.title || '';
              titleInput.id = 'postTitleInput';
              titleEl.replaceWith(titleInput);
            }
          } catch (e) {}

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
              // Read title from inline input if present
              const nextTitle = titleInput ? (titleInput.value || '').trim() : (post.title || '');
              if (!nextTitle) {
                saveBtn.disabled = false;
                alert('Title cannot be empty.');
                return;
              }

              await updatePost(post.id, { body: textarea.value || "", title: nextTitle });

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