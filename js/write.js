// js/write.js
import { getSession, getMyProfile, getMyAuthorStatus, setMyAnonymity, wireAuthButtons } from "./auth.js";
import { createPost } from "./blogApi.js";
import { uploadAndRecordFiles } from "./uploader.js";

const statusMsg = document.getElementById("statusMsg");
const titleEl = document.getElementById("title");
const contentEl = document.getElementById("content");
const filesEl = document.getElementById("files");
const publishBtn = document.getElementById("publishBtn");
const saveDraftBtn = document.getElementById("saveDraftBtn");
const anonToggle = document.getElementById("anonToggle");
const anonStatus = document.getElementById("anonStatus");

const gate = document.getElementById("writeGate");
const form = document.getElementById("writeForm");

function setStatus(t) {
  if (statusMsg) statusMsg.textContent = t || "";
}

function showGate(html) {
  if (gate) {
    gate.style.display = "block";
    gate.innerHTML = html;
  }
  if (form) form.style.display = "none";
}

function showForm() {
  if (gate) gate.style.display = "none";
  if (form) form.style.display = "block";
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

async function wireAnonToggle() {
  if (!anonToggle || !anonStatus) return;

  try {
    const st = await getMyAuthorStatus(); // { user_id, display_name, approved, is_anonymous }
    const isAnon = !!st?.is_anonymous;

    anonToggle.checked = isAnon;
    anonStatus.textContent = isAnon
      ? "Anonymity is ON. Posts/comments will show “Chose Anonymity”."
      : "Anonymity is OFF. Your display name will be shown when available.";

    anonToggle.onchange = async () => {
      anonToggle.disabled = true;
      anonStatus.textContent = "Saving…";
      await setMyAnonymity(anonToggle.checked);
      anonStatus.textContent = anonToggle.checked
        ? "Saved. Anonymity is ON."
        : "Saved. Anonymity is OFF.";
      anonToggle.disabled = false;
    };
  } catch (e) {
    anonStatus.textContent = `Anonymity toggle error: ${e?.message || String(e)}`;
    anonToggle.disabled = true;
  }
}

async function createAndMaybeUpload({ isPublished }) {
  const session = await getSession();
  if (!session) return; // gated already

  const status = await getMyAuthorStatus(); // { user_id, display_name, approved, is_anonymous }
    if (!status?.approved) {
    setStatus("Your account is not approved to publish. Ask the admin to approve your account in Supabase.");
  return;
}

  const authorLabel = status.is_anonymous
  ? "Chose Anonymity"
  : (status.display_name || "Member");

  const title = (titleEl?.value || "").trim();
  const raw = (contentEl?.value || "").trim();
  const files = filesEl?.files ? Array.from(filesEl.files) : [];

  if (!title) throw new Error("Title is required.");
  if (!raw && files.length === 0) throw new Error("Provide post text and/or upload at least one document.");

  const forumSlug = new URLSearchParams(window.location.search).get("forum") || "general-topics";
  const contentText = raw || "";
  const contentHtml = raw ? htmlFromPlainText(raw) : `<div class="muted">Documents attached below.</div>`;

  const created = await createPost({
    title,
    body: contentText,
    forum_slug: new URLSearchParams(window.location.search).get("forum") || "general-topics",
    author_id: status.user_id,
    author_label: authorLabel,
    status: isPublished ? "published" : "draft"
  });

  if (files.length) {
    await uploadAndRecordFiles({
      postId: created.id,
      authorId: profile.user_id,
      files
    });
  }

  window.location.href = `./post.html?id=${encodeURIComponent(created.id)}`;
}

// ---- BOOTSTRAP (one-time) ----
await wireAuthButtons({ loginLinkId: "loginLink", logoutBtnId: "logoutBtn" });

const session = await getSession();
if (!session) {
  showGate(`
    <h2>Login Required</h2>
    <p class="muted">You must be logged in to create a post.</p>
    <a class="btn" href="./login.html">Login</a>
  `);
  // Stop initialization; keep page clean.
} else {
  const st = await getMyAuthorStatus();
  if (!st?.approved) {
    showGate(`
      <h2>Not Approved</h2>
      <p class="muted">Your account is not approved to publish threads yet.</p>
      <p class="muted">If you believe this is an error, contact the site administrator.</p>
    `);
  } else {
    showForm();
    setStatus("Approved author. You can publish.");
    await wireAnonToggle();
  }
}

// ---- BUTTON HANDLERS ----
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
