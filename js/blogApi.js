// js/blogApi.js
import { getSupabaseClient } from "./supabaseClient.js";

export function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Lists posts.
 * @param {object} opts
 * @param {number} opts.limit
 * @param {string} opts.search - best-effort search over title/body
 * @param {boolean} opts.publishedOnly
 * @param {string|null} opts.forum_slug - optional filter
 */
export async function listPosts({
  limit = 20,
  search = "",
  publishedOnly = true,
  forum_slug = null,
} = {}) {
  const sb = getSupabaseClient();

  let q = sb
    .from("posts")
    // ONLY NECESSARY CHANGE:
    // - include author_label (your schema uses this, not posts.display_name)
    // - keep author_id for internal use
    .select("id, title, created_at, author_id, display_name, forum_slug, status, is_anonymous")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (forum_slug) q = q.eq("forum_slug", forum_slug);
  if (publishedOnly) q = q.eq("status", "published");

  const s = String(search || "").trim();
  if (s) {
    q = q.or(`title.ilike.%${s}%,body.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) throw error;

  // Back-compat: some UI code still expects `display_name` on the post object.
  // If `author_label` is not set on the post row, attempt to look up the
  // author's `display_name` from the `authors` table and use that as a
  // fallback before finally falling back to "Member".
  const rowsRaw = data || [];

  // Collect author_ids that need lookup (where display_name is falsy)
  const missingAuthorIds = [...new Set(
    rowsRaw.filter((p) => !p?.display_name).map((p) => p.author_id).filter(Boolean)
  )];

  let authorsMap = {};
  if (missingAuthorIds.length) {
    const { data: authorsData, error: authorsErr } = await sb
      .from("authors")
      .select("user_id, display_name")
      .in("user_id", missingAuthorIds);
    if (!authorsErr && Array.isArray(authorsData)) {
      authorsMap = Object.fromEntries((authorsData || []).map((a) => [a.user_id, a.display_name]));
    }
  }

  const rows = rowsRaw.map((p) => ({
    ...p,
    display_name: p?.is_anonymous
      ? "Anonymous"
      : (p?.display_name || authorsMap[p.author_id] || "Member"),
  }));

  return rows;
}

export async function getPostById(id) {
  const sb = getSupabaseClient();

  const { data, error } = await sb
    .from("posts")
    // ONLY NECESSARY CHANGE: include display_name for back-compat
    .select("id, title, body, status, created_at, author_id, display_name, forum_slug, is_anonymous")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return data;

  // If the row lacks a stored `display_name`, try to read the author's profile
  // to obtain a display_name fallback.
  let fallback = null;
  if (!data?.display_name && data?.author_id) {
    try {
      const { data: authorRow, error: authorErr } = await sb
        .from("authors")
        .select("user_id, display_name")
        .eq("user_id", data.author_id)
        .maybeSingle();
      if (!authorErr && authorRow) fallback = authorRow.display_name;
    } catch (e) {
      // ignore lookup failure; we'll fall back to "Member"
    }
  }

  return {
    ...data,
    display_name: data?.is_anonymous ? "Anonymous" : (data?.display_name || fallback || "Member"),
  };
}

/**
 * Create a post.
 * IMPORTANT: is_anonymous is PER-POST now.
 */
export async function createPost(post) {
  const sb = getSupabaseClient();

  const {
    title,
    body,
    forum_slug,
    author_id,
    status = "draft",
    is_anonymous = false,
  } = post || {};

  // Minimal validation (fail early with clear messages)
  if (!title || !String(title).trim()) throw new Error("createPost: title is required");
  if (body === undefined || body === null) throw new Error("createPost: body is required (cannot be null)");
  if (!forum_slug || !String(forum_slug).trim()) throw new Error("createPost: forum_slug is required");
  if (!author_id) throw new Error("createPost: author_id is required");

  const forumSlugTrim = String(forum_slug).trim();

  // Ensure the forum exists. Some deployments may not pre-populate forums,
  // and the DB enforces a foreign key constraint on posts.forum_slug.
  // Upsert a minimal forum row (slug + a humanized title) so posts can be created.
  try {
    const prettyTitle = forumSlugTrim.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    await sb.from("forums").upsert({ slug: forumSlugTrim, title: prettyTitle }, { onConflict: "slug" });
  } catch (e) {
    // If forum upsert fails for any reason, surface the error.
    throw e;
  }

  // Determine an `author_label` to store on the post so UIs can show a human
  // name even if the `authors` table isn't populated. Prefer the explicit
  // authors.display_name, then the authenticated user's metadata, then null.
  let authorLabel = null;
  try {
    if (author_id) {
      const { data: aRow, error: aErr } = await sb
        .from("authors")
        .select("display_name")
        .eq("user_id", author_id)
        .maybeSingle();
      if (!aErr && aRow?.display_name) authorLabel = aRow.display_name;
    }
  } catch {
    // ignore lookup errors
  }

  if (!authorLabel) {
    try {
      const { data: userData } = await sb.auth.getUser();
      const u = userData?.user;
      authorLabel = (u?.user_metadata && (u.user_metadata.display_name || u.user_metadata.full_name)) || null;
    } catch {
      // ignore
    }
  }

  const { data, error } = await sb
    .from("posts")
    .insert([{
      title: String(title).trim(),
      body: String(body),
      forum_slug: forumSlugTrim,
      author_id,
      display_name: authorLabel,
      status,
      is_anonymous: Boolean(is_anonymous),
    }])
    // ONLY NECESSARY CHANGE: include author_label in returned row (helps UI)
    .select("id,title,created_at,author_id,display_name,forum_slug,status,is_anonymous")
    .single();

  if (error) throw error;
  return data;
}

export async function listComments(postId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("comments")
    .select("id, body, display_name, created_at, is_anonymous")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Add a comment.
 * IMPORTANT: is_anonymous is PER-COMMENT now.
 * @param {string} postId
 * @param {string} body
 * @param {string} displayName
 * @param {boolean} isAnonymous
 */
export async function addComment(postId, body, displayName, isAnonymous = false) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("comments")
    .insert([{
      post_id: postId,
      body,
      display_name: isAnonymous ? null : (displayName || null),
      is_anonymous: Boolean(isAnonymous),
    }])
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function listPostFiles(postId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("post_files")
    .select("id, bucket, object_path, original_name, mime_type, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

// ---------------------------------------------------------------------------
// Compatibility helpers for write.js (author gating + thread creation)
// ---------------------------------------------------------------------------

/**
 * Fetch the current author's profile.
 * write.js expects: { user_id, display_name, approved, is_anonymous }
 */
export async function getAuthorProfile(userId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("authors")
    .select("user_id, display_name, approved, is_anonymous")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

/**
 * Set whether an author is posting anonymously.
 */
export async function setAuthorAnonymousFlag(userId, isAnonymous) {
  const sb = getSupabaseClient();
  const { error } = await sb
    .from("authors")
    .update({ is_anonymous: !!isAnonymous })
    .eq("user_id", userId);

  if (error) throw error;
  return { ok: true };
}

/**
 * Create a new top-level thread.
 * In this schema, a "thread" is simply a post with a forum_slug.
 */
export async function createThread({ forum_slug, title, body, author_id, is_anonymous }) {
  // Map to the existing createPost API in this file
  return await createPost({
    forum_slug,
    title,
    body,
    author_id,
    is_anonymous: !!is_anonymous,
    status: "published",
  });
}