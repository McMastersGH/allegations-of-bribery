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

  if (!user) {
    form.classList.add("hidden");
    notAllowed.classList.remove("hidden");
    return;
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    setStatus("Creating…");
    const slug = $("slug").value.trim();
    const title = $("title").value.trim();
    const description = $("description").value.trim();

    try {
      const created = await createForum({ slug, title, description });
      setStatus(`Created forum: ${created?.slug ?? slug}`);
      form.reset();
    } catch (err) {
      console.error(err);
      setStatus(String(err?.message || err), true);
    }
  });
});
