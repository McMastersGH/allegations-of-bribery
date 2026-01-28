// js/storageApi.js
import { getSupabaseClient } from "./supabaseClient.js";

export async function uploadPostFile({ bucket, path, file }) {
  const sb = getSupabaseClient();
  // Preflight: check whether the bucket exists to give a clearer error message
  try {
    const { data: _list, error: _listErr } = await sb.storage.from(bucket).list("", { limit: 1 });
    if (_listErr) {
      // Surface a helpful message when bucket is missing
      if (String(_listErr.message || "").toLowerCase().includes("bucket")) {
        throw new Error(`Storage bucket "${bucket}" not found. Create it in Supabase Storage or update the bucket name in js/uploader.js`);
      }
      throw _listErr;
    }
  } catch (e) {
    // Re-throw so callers can handle this as a user-facing error
    throw e;
  }
  const { data, error } = await sb.storage.from(bucket).upload(path, file, {
    upsert: false, // IMPORTANT: avoid Storage upsert RLS complications
    contentType: file.type || "application/octet-stream"
  });
  if (error) throw error;
  return data;
}

export async function bucketExists(bucket) {
  const sb = getSupabaseClient();
  try {
    const { data, error } = await sb.storage.from(bucket).list("", { limit: 1 });
    if (error) {
      if (String(error.message || "").toLowerCase().includes("bucket")) return false;
      throw error;
    }
    return true;
  } catch (e) {
    throw e;
  }
}

export function getPublicUrl(bucket, path) {
  const sb = getSupabaseClient();
  try {
    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    if (data?.publicUrl) return data.publicUrl;

    // Fallback: generate a short-lived signed URL (works for private buckets)
    // Expires in 1 hour
    const expiresIn = 60 * 60;
    const { data: signed, error } = sb.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (error) throw error;
    return signed?.signedUrl || null;
  } catch (e) {
    console.error("storage.getPublicUrl error:", e);
    return null;
  }
}
