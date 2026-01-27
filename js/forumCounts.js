// js/forumCounts.js
import { getSupabaseClient } from "./supabaseClient.js";

function findCardForForum(slug) {
  const selector = `a[href="forum.html?forum=${encodeURIComponent(slug)}"]`;
  return document.querySelector(selector);
}

export async function populateForumCounts() {
  if (typeof document === "undefined") return;
  const sb = getSupabaseClient();

  console.debug("populateForumCounts: start");

  // Forum slugs shown on the index page. Extend as needed.
  const slugs = [
    "general-topics",
    "introductions",
    "questions-and-answers",
    "off-topic",
    "judicial-misconduct",
    "public-records",
  ];

  // Show a lightweight loading state for each card immediately
  for (const slug of slugs) {
    const card = findCardForForum(slug);
    if (!card) continue;
    const container = card.querySelector(".mt-3.flex.items-center") || card.querySelector(".mt-3.flex.items-center.gap-4") || card.querySelector(".mt-3.flex.items-center.gap-4.text-xs");
    if (container) {
      container.innerHTML = `
        <div class="mt-3 flex items-center gap-4 text-xs text-slate-500">
          <span><span class="skeleton-line" style="width:72px"></span></span>
          <span><span class="skeleton-line" style="width:56px"></span></span>
        </div>`;
    }
  }

  try {
    console.debug("populateForumCounts: attempting forums table read");
    // Prefer the `forums` table counters (fastest). Fall back to `forum_stats` view or bulk queries.
    try {
      const { data: forumsData, error: forumsErr } = await sb
        .from("forums")
        .select("slug,posts_count,comments_count")
        .in("slug", slugs);

      console.debug("populateForumCounts: forums query returned", { forumsErr, count: forumsData?.length });

      if (!forumsErr && forumsData) {
        const map = Object.create(null);
        for (const f of forumsData) map[f.slug] = f;

        for (const slug of slugs) {
          const card = findCardForForum(slug);
          if (!card) continue;
          const row = map[slug] || { posts_count: 0, comments_count: 0 };
          const postsTotal = (row.posts_count || 0) + (row.comments_count || 0);
          const container = card.querySelector(".mt-3.flex.items-center") || card.querySelector(".mt-3.flex.items-center.gap-4") || card.querySelector(".mt-3.flex.items-center.gap-4.text-xs");
          if (container) {
            container.innerHTML = `<div class=\"mt-3 flex items-center gap-4 text-xs text-slate-500\"><span>Posts: ${postsTotal}</span><span>Threads: ${row.posts_count || 0}</span></div>`;
          }
        }
        return; // done
      }

      // If forums table wasn't available, try the view next
      const { data: statsData, error: statsErr } = await sb
        .from("forum_stats")
        .select("slug,threads,comments")
        .in("slug", slugs);

      if (!statsErr && statsData) {
        const map = Object.create(null);
        for (const s of statsData) map[s.slug] = s;

        console.debug("populateForumCounts: forum_stats view returned", statsData.length);

        for (const slug of slugs) {
          const card = findCardForForum(slug);
          if (!card) continue;
          const row = map[slug] || { threads: 0, comments: 0 };
          const postsTotal = (row.threads || 0) + (row.comments || 0);
          const container = card.querySelector(".mt-3.flex.items-center") || card.querySelector(".mt-3.flex.items-center.gap-4") || card.querySelector(".mt-3.flex.items-center.gap-4.text-xs");
          if (container) {
            container.innerHTML = `<div class=\"mt-3 flex items-center gap-4 text-xs text-slate-500\"><span>Posts: ${postsTotal}</span><span>Threads: ${row.threads || 0}</span></div>`;
          }
        }
        return; // done
      }
    } catch (viewErr) {
      console.debug("populateForumCounts: forums/table/view not available, falling back", viewErr && viewErr.message ? viewErr.message : viewErr);
    }

    // Fallback: bulk fetch published posts for all slugs in one request
    const { data: postsData, error: postsErr } = await sb
      .from("posts")
      .select("id,forum_slug")
      .in("forum_slug", slugs)
      .eq("status", "published")
      .limit(2000);

    if (postsErr) {
      console.error("populateForumCounts: posts query error", postsErr);
      throw postsErr;
    }

    const posts = postsData || [];

    // Map postId -> forum_slug and count threads per forum
    const postToForum = Object.create(null);
    const threadCountByForum = Object.create(null);
    const postIds = [];
    for (const p of posts) {
      if (!p || !p.id) continue;
      postIds.push(p.id);
      postToForum[p.id] = p.forum_slug;
      threadCountByForum[p.forum_slug] = (threadCountByForum[p.forum_slug] || 0) + 1;
    }

    // Bulk fetch comments for all posts we found
    let commentCountByForum = Object.create(null);
    if (postIds.length > 0) {
      const { data: commentsData, error: commentsErr } = await sb
        .from("comments")
        .select("id,post_id")
        .in("post_id", postIds)
        .limit(5000);

      if (commentsErr) {
        console.error("populateForumCounts: comments query error", commentsErr);
        throw commentsErr;
      }

      const comments = commentsData || [];
      for (const c of comments) {
        const forum = postToForum[c.post_id];
        if (!forum) continue;
        commentCountByForum[forum] = (commentCountByForum[forum] || 0) + 1;
      }
    }

    console.debug("populateForumCounts: rendering counts");
    // Render counts into each matching card
    for (const slug of slugs) {
      const card = findCardForForum(slug);
      if (!card) continue;
      const threadCount = threadCountByForum[slug] || 0;
      const commentCount = commentCountByForum[slug] || 0;
      const postsTotal = threadCount + commentCount;

      const container = card.querySelector(".mt-3.flex.items-center") || card.querySelector(".mt-3.flex.items-center.gap-4") || card.querySelector(".mt-3.flex.items-center.gap-4.text-xs");
      if (container) {
        container.innerHTML = `<div class=\"mt-3 flex items-center gap-4 text-xs text-slate-500\"><span>Posts: ${postsTotal}</span><span>Threads: ${threadCount}</span></div>`;
      }
    }
  } catch (e) {
    console.error("populateForumCounts error:", e);
    // On error, leave the loading text or replace with zeros
    for (const slug of slugs) {
      const card = findCardForForum(slug);
      if (!card) continue;
      const container = card.querySelector(".mt-3.flex.items-center") || card.querySelector(".mt-3.flex.items-center.gap-4") || card.querySelector(".mt-3.flex.items-center.gap-4.text-xs");
      if (container) {
        container.innerHTML = `<div class=\"mt-3 flex items-center gap-4 text-xs text-slate-500\"><span>Posts: 0</span><span>Threads: 0</span></div>`;
      }
    }
  }
}

export default populateForumCounts;
