import { createForum } from "./forumApi.js";
import { getSupabaseClient } from "./supabaseClient.js";

const $ = (id) => document.getElementById(id);

function setStatus(msg, isError = false) {
  const el = $("status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("text-rose-300", !!isError);
  el.classList.toggle("text-slate-400", !isError);
}

function slugify(s) {
  if (!s) return "";
  // Lowercase, replace spaces and non-alphanum with dashes, collapse multiple dashes
  return s
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

function validateSlug(slug) {
  if (!slug) return { ok: false, msg: "Required fields missing." };
  if (slug.length < 3) return { ok: false, msg: "Slug must be at least 3 characters." };
  if (slug.length > 50) return { ok: false, msg: "Slug must be 50 characters or less." };
  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, msg: "Use only lower-case letters, numbers and dashes." };
  return { ok: true };
}

async function checkAdmin() {
  const sb = getSupabaseClient();
  // Use server-side helper `is_admin()` to determine admin status.
  // This avoids embedding admin emails in client config and relies on DB-owned list.
  try {
    const { data, error } = await sb.rpc("is_admin");
    if (error) {
      console.error("is_admin RPC error:", error);
      return null;
    }
    // RPC may return boolean directly or an array containing the boolean.
    const isAdmin = data === true || (Array.isArray(data) && data[0] === true);
    return isAdmin ? true : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = await checkAdmin();
  const form = $("createForm");
  const notAllowed = $("notAllowed");
  const titleInput = $("title");
  const submitBtn = $("submitBtn");

  // Auto-validate slug generated from title as the user types
  if (titleInput) {
    titleInput.addEventListener("input", () => {
      const gen = slugify(titleInput.value);
      const check = validateSlug(gen);
      setStatus(check.ok ? "" : check.msg, !check.ok);
      if (submitBtn) submitBtn.disabled = !check.ok;
    });
  }

  if (!user) {
    form.classList.add("hidden");
    notAllowed.classList.remove("hidden");
    return;
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    setStatus("");
    const title = $("title").value.trim();
    // Slug is auto-generated from title
    const slug = slugify(title);
    const description = $("description").value.trim();
    const check = validateSlug(slug);
    if (!check.ok) {
      setStatus(check.msg, true);
      return;
    }

    try {
      if (submitBtn) submitBtn.disabled = true;
      setStatus("Creating…");
      const created = await createForum({ slug, title, description });
      setStatus(`Created forum: ${created?.slug ?? slug}`);
      form.reset();
      if (submitBtn) submitBtn.disabled = false;
    } catch (err) {
      console.error(err);
      setStatus(String(err?.message || err), true);
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
