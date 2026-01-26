// js/write.js
import { wireAuthButtons, getUser } from "./auth.js";
import { createPost, ensureAuthorProfile, getMyProfile } from "./blogApi.js";

function qs(id) {
  return document.getElementById(id);
}

function cleanError(err) {
  if (!err) return "Unknown error.";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function setStatus(msg, isError = false) {
  const el = qs("status");
  if (!el) return;
  el.textContent = msg || "";
  el.style.color = isError ? "#f87171" : ""; // red-400
}

function getForumFromUrl() {
  const u = new URL(window.location.href);
  return (u.searchParams.get("forum") || "").trim();
}

document.addEventListener("DOMContentLoaded", async () => {
  // Header auth UI (if present on this page)
  try {
    await wireAuthButtons();
  } catch {
    // ignore
  }

  const forumSelect = qs("forumSelect");
  const titleEl = qs("title");
  const bodyEl = qs("body");
  const anonEl = qs("anon");
  const publishBtn = qs("publishBtn");
  const cancelBtn = qs("cancelBtn");

  // If coming from a specific forum link, preselect it
  const forumFromUrl = getForumFromUrl();
  if (forumSelect && forumFromUrl) {
    // If the option exists, set it; if not, leave as-is
    const hasOption = Array.from(forumSelect.options || []).some((o) => o.value === forumFromUrl);
    if (hasOption) forumSelect.value = forumFromUrl;
  }

  // Must be logged in to write
  const user = await getUser();
  if (!user) {
    setStatus("Please log in to create a thread.", true);
    if (publishBtn) publishBtn.disabled = true;
    return;
  }

  // Ensure author profile exists and fetch it
  let myProfile = null;
  try {
    await ensureAuthorProfile();
    myProfile = await getMyProfile();
  } catch (err) {
    setStatus(`Unable to load author profile: ${cleanError(err)}`, true);
    if (publishBtn) publishBtn.disabled = true;
    return;
  }

  // If the profile cannot be read due to RLS, myProfile may be null
  if (!myProfile || !myProfile.user_id) {
    setStatus("Unable to load author profile: permission denied for table authors", true);
    if (publishBtn) publishBtn.disabled = true;
    return;
  }

  // Read-only if not approved
  if (!myProfile.approved) {
    setStatus(
      "Read-only: your account is not approved to publish yet. You can browse forums, but you cannot post.",
      true
    );
    if (publishBtn) publishBtn.disabled = true;
  } else {
    setStatus("");
    if (publishBtn) publishBtn.disabled = false;
  }

  // Cancel goes back to the forum page you came from (or index)
  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const slug = (forumSelect?.value || forumFromUrl || "").trim();
      window.location.href = slug ? `./forum.html?forum=${encodeURIComponent(slug)}` : "./index.html";
    });
  }

  // Publish
  if (publishBtn) {
    publishBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (!myProfile?.approved) {
        setStatus(
          "Read-only: your account is not approved to publish yet. You can browse forums, but you cannot post.",
          true
        );
        return;
      }

      const forumSlug = (forumSelect?.value || forumFromUrl || "").trim();
      const title = (titleEl?.value || "").trim();
      const body = (bodyEl?.value || "").trim();
      const isAnonymous = !!anonEl?.checked;

      if (!forumSlug) {
        setStatus("Please select a forum.", true);
        return;
      }
      if (!title) {
        setStatus("Title is required.", true);
        return;
      }
      if (!body) {
        setStatus("Body is required.", true);
        return;
      }

      publishBtn.disabled = true;
      setStatus("Publishing...");

      try {
        // IMPORTANT FIX:
        // The old file referenced `profile.user_id` (undefined). Use `myProfile.user_id`.
        const payload = {
          forumSlug,
          title,
          body,
          authorId: myProfile.user_id,          // always set (even if anonymous)
          isAnonymous: isAnonymous,             // your DB can hide name when true
          displayName: isAnonymous ? null : (myProfile.display_name || null),
        };

        const res = await createPost(payload);

        if (!res?.ok) {
          throw new Error(res?.error || "Publish failed.");
        }

        setStatus("Published.");
        // After publish, go back to the forum
        window.location.href = `./forum.html?forum=${encodeURIComponent(forumSlug)}`;
      } catch (err) {
        console.error("Publish error:", err);
        setStatus(`Publish failed: ${cleanError(err)}`, true);
        publishBtn.disabled = false;
      }
    });
  }
});