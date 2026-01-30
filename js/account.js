// js/account.js
import { getSession, setMyAnonymity } from "./auth.js";
import { getSupabaseClient } from "./supabaseClient.js";

function showMsg(text, type = "muted") {
  const el = document.getElementById("msg");
  if (!el) return;
  el.className = type;
  el.textContent = text;
}

async function loadProfile() {
  try {
    const session = await getSession();
    if (!session || !session.user) {
      window.location.href = "./login.html?from=account";
      return;
    }

    const sb = getSupabaseClient();
    const userId = session.user.id;

    const { data, error } = await sb
      .from("authors")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;

    document.getElementById("email").value = session.user.email || "";
    document.getElementById("displayName").value = data?.display_name || (session.user.user_metadata?.display_name || "");
    document.getElementById("isAnonymous").checked = !!data?.is_anonymous;
    document.getElementById("credentials").value = data?.credentials || data?.title || "";
    document.getElementById("unionAffiliation").value = data?.union_affiliation || data?.union || "";
    document.getElementById("organization").value = data?.organization || data?.employer || data?.org || "";
    document.getElementById("bio").value = data?.bio || data?.about || data?.summary || "";
    document.getElementById("approved").value = data?.approved ? "Yes" : "No";
  } catch (e) {
    console.error(e);
    showMsg("Failed to load profile.", "muted");
  }
}

async function saveProfile(e) {
  e.preventDefault();
  showMsg("Saving...", "muted");
  const saveBtn = document.getElementById("saveBtn");
  const origText = saveBtn ? saveBtn.textContent : null;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  try {
    const session = await getSession();
    if (!session || !session.user) {
      window.location.href = "./login.html?from=account";
      return;
    }

    const sb = getSupabaseClient();
    const userId = session.user.id;
    const displayName = (document.getElementById("displayName").value || "").trim();
    const isAnonymous = document.getElementById("isAnonymous").checked;
    const credentials = (document.getElementById("credentials").value || "").trim();
    const unionAffiliation = (document.getElementById("unionAffiliation").value || "").trim();
    const organization = (document.getElementById("organization").value || "").trim();
    const bio = (document.getElementById("bio").value || "").trim();

    // Upsert profile fields into authors (include email to satisfy NOT NULL constraint)
    const { error: upsertErr } = await sb
      .from("authors")
      .upsert(
        {
          user_id: userId,
          email: session.user.email || null,
          display_name: displayName,
          credentials: credentials || null,
          union_affiliation: unionAffiliation || null,
          organization: organization || null,
          bio: bio || null,
        },
        { onConflict: "user_id" }
      );

    if (upsertErr) throw upsertErr;

    // Update anonymity flag via existing helper to keep behavior consistent
    const { ok, error: anonErr } = await setMyAnonymity(isAnonymous);
    if (!ok) throw new Error(anonErr || "Failed to set anonymity");

    showMsg("Saved.", "muted");
    if (saveBtn) {
      saveBtn.textContent = "Saved";
      // restore original label after a short delay
      setTimeout(() => {
        try { if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = origText || 'Save changes'; } } catch (e) {}
      }, 2500);
    }
    // After saving author profile, sync author's display_name into their posts and comments
    try {
      await sb.rpc("sync_author_display_names_and_comments", { p_user: userId });
    } catch (rpcErr) {
      // Non-fatal: log but continue
      console.warn("sync_author_display_names_and_comments RPC failed:", rpcErr);
    }
    await loadProfile();
  } catch (e) {
    console.error(e);
    showMsg("Failed to save profile.", "muted");
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = origText || 'Save changes'; }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadProfile();
  const form = document.getElementById("accountForm");
  if (form) form.addEventListener("submit", saveProfile);
});
