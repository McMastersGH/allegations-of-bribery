// js/write.js
import { wireAuthButtons, getSession, getMyAuthorStatus, setMyAnonymity, isApprovedAuthor } from "./auth.js";
import { createPost } from "./blogApi.js";
import { uploadAndRecordFiles } from "./uploader.js";

function getForumSlug() {
  const u = new URL(window.location.href);
  return u.searchParams.get("forum") || "";
}

document.addEventListener("DOMContentLoaded", async () => {
  await wireAuthButtons({
    loginLinkId: "loginLink",
    registerLinkId: "registerLink",
    logoutBtnId: "logoutBtn",
    userBadgeId: "userBadge",
    userMenuBtnId: "userMenuBtn",
    logoutRedirect: "./index.html",
  });

  const forumSlug = getForumSlug();

  const statusMsg = document.getElementById("statusMsg");
  const titleEl = document.getElementById("title");
  const contentEl = document.getElementById("content");
  const filesEl = document.getElementById("files");
  const publishBtn = document.getElementById("publishBtn");
  const saveDraftBtn = document.getElementById("saveDraftBtn");

  const anonToggle = document.getElementById("anonToggle");
  const anonStatus = document.getElementById("anonStatus");

  const writeGate = document.getElementById("writeGate");
  const writeForm = document.getElementById("writeForm");

  // Require a forum slug so posts attach to a forum
  if (!forumSlug) {
    if (statusMsg) statusMsg.textContent = "Missing forum parameter. Go back and click New Thread from a forum.";
    if (writeGate) writeGate.style.display = "block";
    if (writeForm) writeForm.style.display = "none";
    return;
  }

  // Load session + author status
  const session = await getSession();
  const status = await getMyAuthorStatus();

  // Not signed in: read-only / block authoring
  if (!session) {
    if (statusMsg) statusMsg.textContent = "You must be logged in to create a thread.";
    if (writeGate) writeGate.style.display = "block";
    if (writeForm) writeForm.style.display = "none";
    return;
  }

  // Signed in but not approved: read-only / block authoring
  // (You said: logged out is read-only; this matches that pattern.)
  const approved = await isApprovedAuthor(session.user.id);
  if (!approved) {
    if (statusMsg) statusMsg.textContent = "Your account is not approved to post yet.";
    if (writeGate) writeGate.style.display = "block";
    if (writeForm) writeForm.style.display = "none";
    return;
  }

  // Approved: show form
  if (writeGate) writeGate.style.display = "none";
  if (writeForm) writeForm.style.display = "block";

  // Anonymity toggle (optional)
  if (anonToggle) {
    anonToggle.checked = !!status.is_anonymous;
    if (anonStatus) anonStatus.textContent = anonToggle.checked ? "Anonymous posting is ON" : "Anonymous posting is OFF";

    anonToggle.addEventListener("change", async () => {
      const v = !!anonToggle.checked;
      const res = await setMyAnonymity(v);
      if (anonStatus) anonStatus.textContent = res.ok ? (v ? "Anonymous posting is ON" : "Anonymous posting is OFF") : (res.error || "Failed to update anonymity.");
    });
  }

  async function createAndMaybeUpload(isDraft) {
    const title = (titleEl?.value || "").trim();
    const body = (contentEl?.value || "").trim();

    if (!title || !body) {
      if (statusMsg) statusMsg.textContent = "Title and content are required.";
      return;
    }

    if (statusMsg) statusMsg.textContent = isDraft ? "Saving draft..." : "Publishing...";

    const created = await createPost({
      forum_slug: forumSlug,
      title,
      body,
      is_draft: !!isDraft,
      is_anonymous: !!anonToggle?.checked,
    });

    const files = Array.from(filesEl?.files || []);
    if (files.length) {
      // ✅ FIX: use the resolved status/session, not a missing profile variable
      await uploadAndRecordFiles({
        postId: created.id,
        authorId: status.user_id,
        files,
      });
    }

    if (statusMsg) statusMsg.textContent = isDraft ? "Draft saved." : "Published.";

    // Back to the forum
    window.location.href = `./forum.html?forum=${encodeURIComponent(forumSlug)}`;
  }

  if (publishBtn) {
    publishBtn.addEventListener("click", async () => {
      try {
        publishBtn.disabled = true;
        await createAndMaybeUpload(false);
      } catch (e) {
        console.error(e);
        if (statusMsg) statusMsg.textContent = `Publish failed: ${String(e)}`;
      } finally {
        publishBtn.disabled = false;
      }
    });
  }

  if (saveDraftBtn) {
    saveDraftBtn.addEventListener("click", async () => {
      try {
        saveDraftBtn.disabled = true;
        await createAndMaybeUpload(true);
      } catch (e) {
        console.error(e);
        if (statusMsg) statusMsg.textContent = `Save failed: ${String(e)}`;
      } finally {
        saveDraftBtn.disabled = false;
      }
    });
  }
});