// js/uploader.js
import { uploadPostFile } from "./storageApi.js";
import { getSupabaseClient } from "./supabaseClient.js";

export async function uploadAndRecordFiles({ postId, authorId, files }) {
  const sb = getSupabaseClient();
  const bucket = "post-uploads";

  const results = [];
  for (const file of files) {
      const safeName = file.name.replace(/[^\w.-]+/g, "_");
    const storagePath = `${authorId}/${postId}/${Date.now()}_${safeName}`;

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