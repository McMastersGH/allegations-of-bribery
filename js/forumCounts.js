// js/forumCounts.js
import { getSupabaseClient } from "./supabaseClient.js";

function findCardForForum(slug) {
  // Match anchors whose href contains `forum=<slug>` to tolerate path/param ordering.
  const part = `forum=${encodeURIComponent(slug)}`;
  const selector = `a[href*="${part}"]`;
  const matches = Array.from(document.querySelectorAll(selector));
  if (!matches.length) return null;

  // Prefer anchors that look like the forum "card" (contain the counts container)
  for (const a of matches) {
    const container = a.querySelector('.mt-3.flex.items-center') || a.querySelector('.mt-3.flex.items-center.gap-4') || a.querySelector('.mt-3.flex.items-center.gap-4.text-xs');
    if (container) {
      console.debug(`findCardForForum: selected anchor with container for slug=${slug}`, a);
      return a;
    }
  }

  // If none of the anchors contain the card UI (e.g., sidebar links), pick the first match
  console.debug(`findCardForForum: no anchor contained card container for slug=${slug}, falling back to first match`, matches[0]);
  return matches[0];
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

    // Debug: show returned forum rows
    console.debug("populateForumCounts: fetched forumsData:", forumsData);

    const map = Object.create(null);
    for (const f of (forumsData || [])) map[f.slug] = f;

    for (const slug of slugs) {
      const card = findCardForForum(slug);
      console.debug(`populateForumCounts: slug=${slug} cardFound=${!!card}`);
      if (!card) continue;
      const row = map[slug] || { posts_count: 0, comments_count: 0 };
      const container = card.querySelector(".mt-3.flex.items-center") || card.querySelector(".mt-3.flex.items-center.gap-4") || card.querySelector(".mt-3.flex.items-center.gap-4.text-xs");
      console.debug(`populateForumCounts: slug=${slug} containerFound=${!!container} row=`, row);
      if (container) {
        container.innerHTML = `<div class="mt-3 flex items-center gap-4 text-xs text-slate-500"><span>Threads: ${row.posts_count || 0}</span><span>Comments: ${row.comments_count || 0}</span></div>`;
        console.debug(`populateForumCounts: updated slug=${slug} posts=${row.posts_count} comments=${row.comments_count}`);
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
