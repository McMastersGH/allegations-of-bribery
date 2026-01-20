// js/write.js
import { requireAuthOrRedirect, getMyProfile, wireAuthButtons } from "./auth.js";
import { createPost } from "./blogApi.js";
import { uploadAndRecordFiles } from "./uploader.js";

const statusMsg = document.getElementById("statusMsg");
const titleEl = document.getElementById("title");
const contentEl = document.getElementById("content");
const filesEl = document.getElementById("files");
const publishBtn = document.getElementById("publishBtn");
const saveDraftBtn = document.getElementById("saveDraftBtn");

function setStatus(t) {
  if (statusMsg) statusMsg.textContent = t || "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlFromPlainText(text) {
  const safe = escapeHtml(text).replace(/\n/g, "<br>");
  return `<div style="white-space:normal;line-height:1.6">${safe}</div>`;
}

async function createAndMaybeUpload({ isPublished }) {
  const session = await requireAuthOrRedirect("./login.html");
  if (!session) return;

  const profile = await getMyProfile();
  if (!profile?.approved) {
  setStatus("Your account is not approved to publish. Ask the admin to set authors.approved = true.");
  return;
  }

  const title = (titleEl?.value || "").trim();
  const raw = (contentEl?.value || "").trim();
  const files = filesEl?.files ? Array.from(filesEl.files) : [];

  if (!title) throw new Error("Title is required.");
  if (!raw && files.length === 0) throw new Error("Provide post text and/or upload at least one document.");

  const contentText = raw || "";
  const contentHtml = raw ? htmlFromPlainText(raw) : `<div class="muted">Documents attached below.</div>`;

  const created = await createPost({
    title,
    content_html: contentHtml,
    content_text: contentText,
    author_id: profile.user_id,
    is_published: Boolean(isPublished)
  });

  if (files.length) {
    await uploadAndRecordFiles({
      postId: created.id,
      authorId: profile.user_id,
      files
    });
  }

  // Drafts are viewable only by the author (enforced in post.js).
  window.location.href = `./post.html?id=${encodeURIComponent(created.id)}`;
}

await wireAuthButtons({ loginLinkId: "loginLink", logoutBtnId: "logoutBtn" });

// Ensure page is only usable by logged-in users (write page requirement)
const session = await requireAuthOrRedirect("./login.html");
if (session) {
  const profile = await getMyProfile();
  if (!profile?.approved) {
    setStatus("Logged in, but not approved to publish yet. Ask the admin to approve your account in Supabase.");
  } else {
    setStatus("Approved author. You can publish.");
  }
}

publishBtn?.addEventListener("click", async () => {
  publishBtn.disabled = true;
  saveDraftBtn.disabled = true;
  try {
    setStatus("Publishing...");
    await createAndMaybeUpload({ isPublished: true });
  } catch (e) {
    setStatus(`Error: ${e?.message || String(e)}`);
  } finally {
    publishBtn.disabled = false;
    saveDraftBtn.disabled = false;
  }
});

saveDraftBtn?.addEventListener("click", async () => {
  publishBtn.disabled = true;
  saveDraftBtn.disabled = true;
  try {
    setStatus("Saving draft...");
    await createAndMaybeUpload({ isPublished: false });
  } catch (e) {
    setStatus(`Error: ${e?.message || String(e)}`);
  } finally {
    publishBtn.disabled = false;
    saveDraftBtn.disabled = false;
  }
});
