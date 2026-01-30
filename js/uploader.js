// js/uploader.js
import { uploadPostFile, bucketExists } from "./storageApi.js";
import { POST_UPLOADS_BUCKET } from "./config.js";
import { getSupabaseClient } from "./supabaseClient.js";

export async function uploadAndRecordFiles({ postId, authorId, files }) {
  const sb = getSupabaseClient();
  const bucket = POST_UPLOADS_BUCKET;
  // Ensure the bucket exists before attempting uploads to surface a helpful error
  try {
    const ok = await bucketExists(bucket);
    if (!ok) throw new Error(`Storage bucket \"${bucket}\" not found. Create it in Supabase Storage or change the bucket name in js/uploader.js`);
  } catch (e) {
    throw e;
  }

  const results = [];
  for (const file of files) {
      if (!authorId) throw new Error('Missing authorId for file upload. Ensure the user is signed in.');

      // Normalize filename; fall back to a safe generated name if the result is empty or only dots
      let safeName = (file.name || "").replace(/[^\w.-]+/g, "_");
      if (!safeName || /^\.+$/.test(safeName)) {
        safeName = `file_${Date.now()}`;
      }
      // Avoid embedding the uploader's user id in object paths to reduce
      // accidental exposure of identifiers. Use the post id as the top-level
      // folder and a timestamped filename instead.
      const storagePath = `${postId}/${Date.now()}_${safeName}`;

    // Upload original file to Storage
    await uploadPostFile({ bucket, path: storagePath, file });

    // Record metadata in DB
    const { data, error } = await sb
      .from("post_files")
      .insert([{
        post_id: postId,
        author_id: authorId,
        bucket,
        object_path: storagePath,
        original_name: file.name,
        mime_type: file.type || null
      }])
      .select("id, bucket, object_path, original_name")
      .single();

    if (error) throw error;
    results.push(data);
  }

  return results;
}

export async function uploadAndRecordCommentFiles({ commentId, authorId, files }) {
  const sb = getSupabaseClient();
  const bucket = POST_UPLOADS_BUCKET;
  try {
    const ok = await bucketExists(bucket);
    if (!ok) throw new Error(`Storage bucket "${bucket}" not found. Create it in Supabase Storage or change the bucket name in js/config.js`);
  } catch (e) {
    throw e;
  }

  const results = [];
  for (const file of files) {
    if (!authorId) throw new Error('Missing authorId for file upload. Ensure the user is signed in.');

    let safeName = (file.name || "").replace(/[^\\w.-]+/g, "_");
    if (!safeName || /^\.+$/.test(safeName)) {
      safeName = `file_${Date.now()}`;
    }
    // For comment attachments, avoid using the uploader id in the path.
    const storagePath = `${commentId}/${Date.now()}_${safeName}`;

    await uploadPostFile({ bucket, path: storagePath, file });

    const { data, error } = await sb
      .from("comment_files")
      .insert([{
        comment_id: commentId,
        author_id: authorId,
        bucket,
        object_path: storagePath,
        original_name: file.name,
        mime_type: file.type || null
      }])
      .select("id, bucket, object_path, original_name")
      .single();

    if (error) throw error;
    results.push(data);
  }

  return results;
}