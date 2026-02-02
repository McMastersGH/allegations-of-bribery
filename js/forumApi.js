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