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