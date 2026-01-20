// js/storageApi.js
import { getSupabaseClient } from "./supabaseClient.js";

export async function uploadPostFile({ bucket, path, file }) {
  const sb = getSupabaseClient();
  const { data, error } = await sb.storage.from(bucket).upload(path, file, {
    upsert: false, // IMPORTANT: avoid Storage upsert RLS complications
    contentType: file.type || "application/octet-stream"
  });
  if (error) throw error;
  return data;
}

export function getPublicUrl(bucket, path) {
  const sb = getSupabaseClient();
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
