// js/write.js
import { wireAuthButtons, getSession } from "./auth.js";
import { ensureAuthorProfile, getMyProfile, createPost } from "./blogApi.js";

/**
 * Write page (new thread)
 * URL: write.html?forum=<slug>
 * Requires: logged-in + approved author
 */

function $(id) { return document.getElementById(id); }

function getForumSlug() {
  const u = new URL(window.location.href);
  return (u.searchParams.get("forum") || "").trim() || "general-topics";
}

function setText(el, text) { if (el) el.textContent = text ?? ""; }
function show(el) { if (el) el.style.display = ""; }
function hide(el) { if (el) el.style.display = "none"; }

function setStatus(msg, isError = false) {
  // Support both old/new markup
  const status = $("status") || $("statusMsg");
  const err = $("errorMsg");

  if (err) {
    if (isError) { setText(err, msg); show(err); }
    else { setText(err, ""); hide(err); }
  }
  if (status) setText(status, isError ? "" : msg);
}

function disablePublishing(disabled = true) {
  const publishBtn = $("publishBtn");
  if (publishBtn) publishBtn.disabled = !!disabled;
}

function loginRedirect(nextUrl) {
  const next = encodeURIComponent(nextUrl || (window.location.pathname + window.location.search));
  window.location.href = `./login.html?next=${next}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  // Header auth UI
  try { await wireAuthButtons(); } catch (e) { console.warn("wireAuthButtons failed", e); }

  // Elements (support both old/new markup)
  const form = $("publishForm") || $("composeForm");
  const titleEl = $("titleInput") || $("title");
  const bodyEl = $("bodyInput") || $("body");
  const anonEl = $("anonToggle") || $("anonCheck") || $("anon");
  const backEl = $("backLink") || $("cancelBtn") || $("cancelLink");
  const forumLabelEl = $("forumLabel") || $("forumSlug") || $("forumDesc");

  const slug = getForumSlug();

  // Back link
  if (backEl) {
    backEl.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = `./forum.html?forum=${encodeURIComponent(slug)}`;
    });
  }

  // Forum label (if present)
  if (forumLabelEl) forumLabelEl.textContent = slug;

  // Require session
  const session = await getSession();
  if (!session?.user) {
    setStatus("You must be logged in to start a new thread.", true);
    disablePublishing(true);
    setTimeout(() => loginRedirect(`./write.html?forum=${encodeURIComponent(slug)}`), 600);
    return;
  }

  // Ensure author profile exists & load it (approval gate)
  const ensured = await ensureAuthorProfile(session.user, { defaultApproved: false });
  if (!ensured.ok) {
    setStatus(`Unable to load author profile: ${ensured.error}`, true);
    disablePublishing(true);
    return;
  }

  const myProfileRes = await getMyProfile(session.user.id);
  if (!myProfileRes.ok) {
    setStatus(`Unable to load author profile: ${myProfileRes.error}`, true);
    disablePublishing(true);
    return;
  }

  const approved = !!myProfileRes.profile?.approved;
  if (!approved) {
    setStatus(
      "Read-only: your account is not approved to publish yet. You can browse forums, but you cannot post.",
      true
    );
    disablePublishing(true);
    return;
  }

  async function doPublish() {
    setStatus("Publishing...");
    const title = (titleEl?.value || "").trim();
    const body = (bodyEl?.value || "").trim();
    const isAnonymous = !!(anonEl?.checked);

    if (!title) return setStatus("Title is required.", true);
    if (!body) return setStatus("Body is required.", true);

    disablePublishing(true);

    const res = await createPost({
      forum_slug: slug,
      title,
      body,
      status: "published",
      is_anonymous: isAnonymous
    });

    if (!res.ok) {
      setStatus(res.error || "Publish failed.", true);
      disablePublishing(false);
      return;
    }

    // Success
    window.location.href = `./forum.html?forum=${encodeURIComponent(slug)}`;
  }

  // IMPORTANT: prevent page refresh by handling FORM SUBMIT
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await doPublish();
    });
  }

  // Also bind click as a safety net
  const publishBtn = $("publishBtn");
  if (publishBtn) {
    publishBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      await doPublish();
    });
  }

  setStatus("");
  disablePublishing(false);
});