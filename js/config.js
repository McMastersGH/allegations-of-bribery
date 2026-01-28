// js/config.js
// Centralized runtime configuration for client-side code.
// Change this to match your Supabase Storage bucket name.
// Common choices: 'post-uploads', 'uploads', or a project-specific bucket.
// Change this to match your Supabase Storage bucket name if needed.
// Using 'post-files' which is already provisioned in your project.
export const POST_UPLOADS_BUCKET = "post-files";
// Optional: force site to display times in a specific IANA timezone.
// Set to null or empty string to use the user's local browser timezone instead.
export const SITE_TIMEZONE = "America/New_York";
