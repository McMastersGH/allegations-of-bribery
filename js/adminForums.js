import { createForum } from "./forumApi.js";
import { getSupabaseClient } from "./supabaseClient.js";
import { ADMIN_EMAILS } from "./config.js";

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
  const res = await sb.auth.getUser();
  const user = res?.data?.user ?? null;
  if (!user || !user.email) return null;
  return ADMIN_EMAILS.includes(user.email.toLowerCase()) ? user : null;
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
