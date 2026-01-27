// js/write.js
import { getSession, getMyAuthorStatus } from "./auth.js";
import { createPost } from "./blogApi.js";
import { uploadAndRecordFiles } from "./uploader.js";

const $ = (id) => document.getElementById(id);

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

    const data = await createPost({
      forum_slug: forum,
      title,
      body,
      author_id: session.user.id,
      status: publish ? "published" : "draft",
      is_anonymous: !!isAnonymous,
    });

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
});