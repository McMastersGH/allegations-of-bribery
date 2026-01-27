// js/forumCounts.js
import { getSupabaseClient } from "./supabaseClient.js";

function findCardForForum(slug) {
  // Find anchor that links to the forum page for this slug
  const selector = `a[href="forum.html?forum=${encodeURIComponent(slug)}"]`;
  return document.querySelector(selector);
}

export async function populateForumCounts() {
  if (typeof document === "undefined") return;
  const sb = getSupabaseClient();

  // Known forum slugs used on the index page. If you add more cards, include them here.
  const slugs = [
    "general-topics",
    "introductions",
    "questions-and-answers",
    "off-topic",
    "judicial-misconduct",
    "public-records",
  ];

  for (const slug of slugs) {
    try {
      const card = findCardForForum(slug);
      if (!card) continue;

      // Fetch published threads (posts with forum_slug)
      const { data: postsData, error: postErr } = await sb
        .from("posts")
        .select("id")
        .eq("forum_slug", slug)
        .eq("status", "published")
        .limit(1000);

      if (postErr) throw postErr;
      const threadCount = (postsData || []).length;

      // Count comments for those post ids (if any)
      let commentCount = 0;
      if (threadCount > 0) {
        const postIds = postsData.map((p) => p.id).filter(Boolean);
        const res = await sb
          .from("comments")
          .select("id", { count: "exact", head: true })
          .in("post_id", postIds);
        commentCount = res?.count || 0;
      }

      const postsTotal = threadCount + commentCount;

      // Replace the static counts inside the card
      const countsContainer = card.querySelector(".mt-3.flex.items-center") || card.querySelector(".mt-3.flex.items-center.gap-4") || card.querySelector(".mt-3.flex.items-center.gap-4.text-xs");
      // Fallback: find the last div with two span children
      let container = countsContainer;
      if (!container) {
        container = card.querySelector("div");
      }

      if (container) {
        container.innerHTML = `<div class=\"mt-3 flex items-center gap-4 text-xs text-slate-500\"><span>Posts: ${postsTotal}</span><span>Threads: ${threadCount}</span></div>`;
      }
    } catch (e) {
      // don't break the loop if one forum fails
      console.error("populateForumCounts error for", slug, e);
    }
  }
}

export default populateForumCounts;
