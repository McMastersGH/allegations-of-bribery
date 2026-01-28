// js/forumCounts.js
import { getSupabaseClient } from "./supabaseClient.js";

function findCardForForum(slug) {
  const selector = `a[href="forum.html?forum=${encodeURIComponent(slug)}"]`;
  return document.querySelector(selector);
}

export async function populateForumCounts() {
  if (typeof document === "undefined") return;
  const sb = getSupabaseClient();

  const slugs = [
    "general-topics",
    "union-matters",
    "questions-and-answers",
    "off-topic",
    "judicial-misconduct",
    "public-records",
  ];

  // Show skeleton placeholders
  for (const slug of slugs) {
    const card = findCardForForum(slug);
    if (!card) continue;
    const container = card.querySelector(".mt-3.flex.items-center") || card.querySelector(".mt-3.flex.items-center.gap-4") || card.querySelector(".mt-3.flex.items-center.gap-4.text-xs");
    if (container) {
      container.innerHTML = `
        <div class="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <span><span class="skeleton-line" style="width:72px"></span></span>
          <span><span class="skeleton-line" style="width:48px"></span></span>
        </div>`;
    }
  }

  try {
    const { data: forumsData, error: forumsErr } = await sb
      .from("forums")
      .select("slug,posts_count,comments_count")
      .in("slug", slugs);

    if (forumsErr) throw forumsErr;

    const map = Object.create(null);
    for (const f of (forumsData || [])) map[f.slug] = f;

    for (const slug of slugs) {
      const card = findCardForForum(slug);
      if (!card) continue;
      const row = map[slug] || { posts_count: 0, comments_count: 0 };
      const container = card.querySelector(".mt-3.flex.items-center") || card.querySelector(".mt-3.flex.items-center.gap-4") || card.querySelector(".mt-3.flex.items-center.gap-4.text-xs");
      if (container) {
        container.innerHTML = `<div class="mt-3 flex items-center gap-4 text-xs text-slate-500"><span>Threads: ${row.posts_count || 0}</span><span>Comments: ${row.comments_count || 0}</span></div>`;
      }
    }
  } catch (e) {
    // On error, fall back to zeros
    for (const slug of slugs) {
      const card = findCardForForum(slug);
      if (!card) continue;
      const container = card.querySelector(".mt-3.flex.items-center") || card.querySelector(".mt-3.flex.items-center.gap-4") || card.querySelector(".mt-3.flex.items-center.gap-4.text-xs");
      if (container) {
        container.innerHTML = `<div class=\"mt-3 flex items-center gap-4 text-xs text-slate-500\"><span>Threads: 0</span><span>Comments: 0</span></div>`;
      }
    }
  }
}

export default populateForumCounts;
