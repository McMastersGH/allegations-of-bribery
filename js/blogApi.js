// js/blogApi.js
import { getSupabaseClient } from "./supabaseClient.js";

function normalizeId(raw) {
  if (!raw) return raw;
  const s = String(raw || "").trim();
  const m = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  if (m) return m[0];
  return s.replace(/[.,;:]+$/g, "");
}

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
  // If caller is unauthenticated, read from `public_posts` to avoid exposing
  // author-identifying columns to anon clients. Authenticated callers read
  // from the base `posts` table and receive `author_id` where available.
  const { data: userData } = await sb.auth.getUser();
  const currentUser = userData?.user || null;
  const anon = !currentUser;

  const source = anon ? 'public_posts' : 'posts';
  const cols = anon
    ? 'id, title, created_at, display_name, forum_slug, status, is_anonymous, views_count'
    : 'id, title, created_at, display_name, forum_slug, status, is_anonymous, author_id';

  let q = sb.from(source).select(cols).order('created_at', { ascending: false }).limit(limit);
  if (forum_slug) q = q.eq('forum_slug', forum_slug);
  if (publishedOnly) q = q.eq('status', 'published');

  const s = String(search || '').trim();
  if (s) q = q.or(`title.ilike.%${s}%,body.ilike.%${s}%`);

  const { data, error } = await q;
  if (error) throw error;

  const rowsRaw = data || [];

  // For anonymous callers, `display_name` is expected to be present on the
  // view rows already. For authenticated callers, perform the same fallback
  // lookup as before to populate missing `display_name` from `authors`.
  if (anon) {
    return rowsRaw.map((p) => ({
      ...p,
      display_name: p?.is_anonymous ? 'Anonymous' : (p?.display_name || 'Member'),
    }));
  }

  // Authenticated path: lookup missing author display names
  const missingAuthorIds = [...new Set(
    rowsRaw.filter((p) => !p?.display_name).map((p) => p.author_id).filter(Boolean)
  )];

  let authorsMap = {};
  if (missingAuthorIds.length) {
    const { data: authorsData, error: authorsErr } = await sb
      .from('authors')
      .select('user_id, display_name')
      .in('user_id', missingAuthorIds);
    if (!authorsErr && Array.isArray(authorsData)) {
      authorsMap = Object.fromEntries((authorsData || []).map((a) => [a.user_id, a.display_name]));
    }
  }

  const rows = rowsRaw.map((p) => ({
    ...p,
    display_name: p?.is_anonymous ? 'Anonymous' : (p?.display_name || authorsMap[p.author_id] || 'Member'),
  }));

  return rows;
}

export async function getPostById(id) {
  const sb = getSupabaseClient();

  const cleaned = normalizeId(id);

  // If caller is unauthenticated, read from the `public_posts` view so anon
  // clients cannot select identifying columns. If authenticated, read the
  // base `posts` table (for drafts/author-only views) but still avoid
  // returning sensitive fields unless required by the caller.
  let data, error;
  try {
    const { data: userData } = await sb.auth.getUser();
    const currentUser = userData?.user || null;
    const anon = !currentUser;
    const colsAuth = 'id, title, body, status, created_at, display_name, forum_slug, is_anonymous, author_id';
    const colsAnon = 'id, title, body, status, created_at, display_name, forum_slug, is_anonymous';
    const source = anon ? 'public_posts' : 'posts';
    const cols = anon ? colsAnon + ', views_count' : colsAuth + ', views_count';
    const res = await sb.from(source).select(cols).eq('id', cleaned).maybeSingle();
    data = res.data; error = res.error;
  } catch (e) {
    throw e;
  }

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
        .eq("user_id", normalizeId(data.author_id))
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

  // Determine a `display_name` to store on the post so UIs can show a human
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
    // ONLY NECESSARY CHANGE: include display_name in returned row (helps UI)
    .select("id,title,created_at,author_id,display_name,forum_slug,status,is_anonymous")
    .single();

  if (error) throw error;
  return data;
}

export async function updatePost(postId, updates) {
  const sb = getSupabaseClient();
  if (!postId) throw new Error("updatePost: postId is required");
  const { data, error } = await sb
    .from("posts")
    .update(updates)
    .eq("id", normalizeId(postId))
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deletePost(postId, reason = null) {
  const sb = getSupabaseClient();
  if (!postId) throw new Error("deletePost: postId is required");
  // Log deletion attempt (best-effort). Function runs as SECURITY DEFINER
  try {
    await sb.rpc('log_deletion', { p_entity_type: 'post', p_entity_id: normalizeId(postId), p_reason: reason });
  } catch (e) {
    // non-fatal, continue to attempt deletion
    console.warn('log_deletion RPC failed:', e);
  }

  const { data, error } = await sb
    .from("posts")
    .delete()
    .eq("id", normalizeId(postId))
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listComments(postId) {
  const sb = getSupabaseClient();
  // Include author_id when available so the client can determine ownership
  // Return comments for a post. The comments table contains `author_id`, but
  // public clients should not receive those identifiers — so we only select
  // safe display fields here. Use public view for anonymous callers.
  const { data: userData } = await sb.auth.getUser();
  const currentUser = userData?.user || null;
  const anon = !currentUser;
  const source = anon ? 'public_comments' : 'comments';
  const cols = anon
    ? 'id, post_id, parent_id, body, display_name, created_at, is_anonymous'
    : 'id, post_id, parent_id, body, display_name, created_at, is_anonymous, author_id';

  const { data, error } = await sb
    .from(source)
    .select(cols)
    .eq('post_id', normalizeId(postId))
    .order('created_at', { ascending: true });

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
export async function addComment(postId, body, displayName, isAnonymous = false, authorId = null) {
  const sb = getSupabaseClient();
  // Prefer an explicit `authorId` passed from the UI; otherwise try to read
  // the currently authenticated user from the client SDK.
  let attachAuthorId = authorId || null;
  if (!attachAuthorId) {
    try {
      const { data: userData } = await sb.auth.getUser();
      const u = userData?.user;
      if (u?.id) attachAuthorId = u.id;
    } catch {
      // ignore; author_id may remain null
    }
  }

  // Support optional parent_id for replies (passed via last argument)
  const maybeParentId = arguments.length >= 6 ? normalizeId(arguments[5]) : null;

  const insertRow = {
    post_id: normalizeId(postId),
    body,
    display_name: isAnonymous ? null : (displayName || null),
    is_anonymous: Boolean(isAnonymous),
    author_id: attachAuthorId,
  };
  if (maybeParentId) insertRow.parent_id = maybeParentId;

  const { data, error } = await sb
    .from("comments")
    .insert([insertRow])
    .select("id")
    .single();

  if (error) throw error;
  return data;
}

export async function updateComment(commentId, body) {
  const sb = getSupabaseClient();
  if (!commentId) throw new Error("updateComment: commentId is required");
  const { data, error } = await sb
    .from("comments")
    .update({ body })
    .eq("id", normalizeId(commentId))
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteComment(commentId, reason = null) {
  const sb = getSupabaseClient();
  if (!commentId) throw new Error("deleteComment: commentId is required");
  try {
    await sb.rpc('log_deletion', { p_entity_type: 'comment', p_entity_id: normalizeId(commentId), p_reason: reason });
  } catch (e) {
    console.warn('log_deletion RPC failed:', e);
  }

  const { data, error } = await sb
    .from("comments")
    .delete()
    .eq("id", normalizeId(commentId))
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listPostFiles(postId) {
  const sb = getSupabaseClient();
  // Use the public_post_files view for anonymous callers so public clients
  // cannot read files for unpublished posts or other sensitive rows.
  const { data: userData } = await sb.auth.getUser();
  const currentUser = userData?.user || null;
  const anon = !currentUser;
  const source = anon ? 'public_post_files' : 'post_files';
  const cols = anon
    ? 'id, post_id, original_name, mime_type, created_at, bucket, object_path'
    : 'id, post_id, bucket, object_path, original_name, mime_type, created_at';
  const { data, error } = await sb
    .from(source)
    .select(cols)
    .eq(anon ? 'post_id' : 'post_id', normalizeId(postId))
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function listCommentFiles(commentId) {
  const sb = getSupabaseClient();
  const { data: userData } = await sb.auth.getUser();
  const currentUser = userData?.user || null;
  const anon = !currentUser;
  const source = anon ? 'public_comment_files' : 'comment_files';
  const cols = anon
    ? 'id, comment_id, original_name, mime_type, created_at, bucket, object_path'
    : 'id, comment_id, bucket, object_path, original_name, mime_type, created_at';
  const { data, error } = await sb
    .from(source)
    .select(cols)
    .eq('comment_id', normalizeId(commentId))
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Fetch threads authored by a user, including comment counts, unviewed counts,
 * and recent comment excerpts via a single RPC for performance.
 */
export async function getAuthorThreadsWithUnviewed(userId) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc('get_author_threads_unviewed', { p_user: userId });
  if (error) throw error;
  return data || [];
}

/**
 * Mark a post as seen for a user (upsert into post_views.last_seen_at = now)
 */
export async function markPostSeen(userId, postId) {
  const sb = getSupabaseClient();
  if (!userId) throw new Error('markPostSeen: userId required');
  if (!postId) throw new Error('markPostSeen: postId required');
  const { error } = await sb.from('post_views').upsert(
    { user_id: userId, post_id: postId, last_seen_at: new Date().toISOString() },
    { onConflict: 'user_id,post_id' }
  );
  if (error) throw error;
  return { ok: true };
}

/**
 * List posts that have no comments (unanswered threads).
 * @param {object} opts
 * @param {number} opts.limit
 * @param {string|null} opts.forum_slug
 */
export async function listUnansweredPosts({ limit = 50, forum_slug = null } = {}) {
  const sb = getSupabaseClient();

  let q = sb
    .from('posts')
    // include a small comments relationship so we can filter client-side
    .select('id, title, created_at, display_name, forum_slug, is_anonymous, author_id, comments(id)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (forum_slug) q = q.eq('forum_slug', forum_slug);
  q = q.eq('status', 'published');

  const { data, error } = await q;
  if (error) throw error;

  const rowsRaw = data || [];

  // Keep only rows with zero comments
  const unanswered = rowsRaw.filter((r) => !Array.isArray(r.comments) || r.comments.length === 0);

  // Back-compat: ensure display_name exists similar to listPosts
  const missingAuthorIds = [...new Set(
    unanswered.filter((p) => !p?.display_name).map((p) => p.author_id).filter(Boolean)
  )];

  let authorsMap = {};
  if (missingAuthorIds.length) {
    const { data: authorsData, error: authorsErr } = await sb
      .from('authors')
      .select('user_id, display_name')
      .in('user_id', missingAuthorIds);
    if (!authorsErr && Array.isArray(authorsData)) {
      authorsMap = Object.fromEntries((authorsData || []).map((a) => [a.user_id, a.display_name]));
    }
  }

  const rows = unanswered.map((p) => ({
    id: p.id,
    title: p.title,
    created_at: p.created_at,
    author_id: p.author_id,
    display_name: p?.is_anonymous ? 'Anonymous' : (p?.display_name || authorsMap[p.author_id] || 'Member'),
    forum_slug: p.forum_slug,
  }));

  return rows;
}

/**
 * Delete a post file record and its storage object.
 * @param {string} fileId
 */
export async function deletePostFile(fileId) {
  const sb = getSupabaseClient();
  if (!fileId) throw new Error("deletePostFile: fileId is required");

  // Lookup the DB row first
  const { data: row, error: rowErr } = await sb
    .from('post_files')
    .select('id, bucket, object_path')
    .eq('id', normalizeId(fileId))
    .maybeSingle();
  if (rowErr) throw rowErr;
  if (!row) throw new Error('post file not found');

  // Attempt to remove the storage object (best-effort)
  try {
    const { error: remErr } = await sb.storage.from(row.bucket).remove([row.object_path]);
    if (remErr) throw remErr;
  } catch (e) {
    // If storage delete fails, surface the error
    throw e;
  }

  // Delete DB record
  const { data, error } = await sb
    .from('post_files')
    .delete()
    .eq('id', normalizeId(fileId))
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Delete a comment file record and its storage object.
 * @param {string} fileId
 */
export async function deleteCommentFile(fileId) {
  const sb = getSupabaseClient();
  if (!fileId) throw new Error("deleteCommentFile: fileId is required");

  // Lookup the DB row first
  const { data: row, error: rowErr } = await sb
    .from('comment_files')
    .select('id, bucket, object_path')
    .eq('id', normalizeId(fileId))
    .maybeSingle();
  if (rowErr) throw rowErr;
  if (!row) throw new Error('comment file not found');

  // Attempt to remove the storage object (best-effort)
  try {
    const { error: remErr } = await sb.storage.from(row.bucket).remove([row.object_path]);
    if (remErr) throw remErr;
  } catch (e) {
    // If storage delete fails, surface the error
    throw e;
  }

  // Delete DB record
  const { data, error } = await sb
    .from('comment_files')
    .delete()
    .eq('id', normalizeId(fileId))
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return data;
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
  // Select all columns so deployments that extended `authors` (credentials,
  // union_affiliation, bio, etc.) will have those fields available to the
  // client without requiring further migrations here.
  const { data, error } = await sb
    .from("authors")
    .select("*")
    .eq("user_id", normalizeId(userId))
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