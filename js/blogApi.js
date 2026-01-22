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
 * @param {string} opts.search - best-effort search over title/content_text
 * @param {boolean} opts.publishedOnly
 */
export async function listPosts({ limit = 20, search = "", publishedOnly = true } = {}) {
  const sb = getSupabaseClient();

  let q = sb
    .from("posts")
    .select("id, title, created_at, author_id, status")
    .order("created_at", { ascending: false })
    .limit(limit);

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
    .select("id, title, body, status, created_at, author_id")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createPost({ title, body, forum_slug, author_id, status }) {
  const sb = getSupabaseClient();

  const { data, error } = await sb
    .from("posts")
    .insert([{
      title,
      body,
      forum_slug,
      author_id,
      status
    }])
    .select("id,title,created_at,author_id,forum_slug,status")
    .single();

  if (error) throw error;
  return data;
}

export async function listComments(postId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("comments")
    .select("id, body, display_name, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function addComment(postId, body, displayName) {
  const sb = getSupabaseClient();
  const { data, error } = await sb
    .from("comments")
    .insert([{
      post_id: postId,
      body,
      display_name: displayName || "Member"
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