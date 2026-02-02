// js/forumApi.js
import { getSupabaseClient } from "./supabaseClient.js";

/**
 * Fetch a forum row by its slug.
 * Expected columns in `forums`: slug, title, description
 */
export async function getForumBySlug(slug) {
  const sb = getSupabaseClient();

  const { data, error } = await sb
    .from("forums")
    .select("slug, title, description")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

/**
 * Create a new forum row.
 * @param {{slug:string,title?:string,description?:string}} opts
 */
export async function createForum(opts) {
  const sb = getSupabaseClient();
  if (!opts || !opts.slug) throw new Error("Missing forum slug");

  const slug = String(opts.slug).trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("Invalid forum slug. Use lower-case letters, numbers and dashes only.");
  }

  // Check for existing forum
  const { data: existing, error: checkErr } = await sb
    .from("forums")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  if (checkErr) throw checkErr;
  if (existing) throw new Error("Forum with this slug already exists");

  const payload = {
    slug,
    title: opts.title || null,
    description: opts.description || null,
  };

  const { data, error } = await sb.from("forums").insert([payload]).select().maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Delete a forum by slug. Only admins may delete (enforced via RLS).
 * Optionally provide a `reason` for the deletion which will be recorded.
 */
export async function deleteForum(slug, reason = null) {
  const sb = getSupabaseClient();
  if (!slug) throw new Error('deleteForum: slug is required');
  try {
    await sb.rpc('log_deletion', { p_entity_type: 'forum', p_entity_id: slug, p_reason: reason });
  } catch (e) {
    console.warn('log_deletion RPC failed:', e);
  }
  const { data, error } = await sb.from('forums').delete().eq('slug', slug).select('slug').maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Return all forums for listing.
 * @param {{onlyActive?:boolean}} opts
 */
export async function getAllForums(opts = {}) {
  const sb = getSupabaseClient();
  const q = sb.from("forums").select("slug, title, description, posts_count, comments_count, is_active, created_at").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (opts.onlyActive) q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}