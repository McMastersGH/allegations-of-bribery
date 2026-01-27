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
    .select("id, title, created_at, author_id, forum_slug, status, is_anonymous")
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
  return data || [];
}

export async function getPostById(id) {
  const sb = getSupabaseClient();

  const { data, error } = await sb
    .from("posts")
    .select("id, title, body, status, created_at, author_id, forum_slug, is_anonymous")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
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

  const { data, error } = await sb
    .from("posts")
    .insert([{
      title: String(title).trim(),
      body: String(body),
      forum_slug: String(forum_slug).trim(),
      author_id,
      status,
      is_anonymous: Boolean(is_anonymous),
    }])
    .select("id,title,created_at,author_id,forum_slug,status,is_anonymous")
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
      display_name: displayName || "Member",
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