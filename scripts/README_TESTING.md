Quick test instructions for `migrations/20260130_public_views_and_file_rbac.sql`

1) Prerequisites
- Node 18+ (for global fetch) or a Node runtime that supports fetch.
- Environment variables set in your shell:
  - `SUPABASE_URL` (e.g. https://xyz.supabase.co)
  - `SUPABASE_ANON_KEY` (your anon/public API key)
  - Optional: `SUPABASE_SERVICE_ROLE_KEY` (for verifying server-side access)

2) Run the verification script
From the repo root:

```bash
node scripts/test_public_views.cjs
```

3) Expected results
- `public_posts` and `public_post_files` requests should return 200 and data (or empty array) when using the anon key.
- Direct requests to `posts` or `post_files` using the anon key should return 401/403 or an error after the migration runs.
- If `SUPABASE_SERVICE_ROLE_KEY` is provided, requests to `post_files` should succeed and return `bucket`/`object_path` fields.

4) If anon client calls still request table columns directly
- Either deploy the updated client JS (we patched `js/blogApi.js`) or re-grant SELECT to `anon` temporarily:

```sql
GRANT SELECT ON posts TO anon;
GRANT SELECT ON comments TO anon;
GRANT SELECT ON post_files TO anon;
GRANT SELECT ON comment_files TO anon;
```

5) Run migration (once client is deployed)
- Use Supabase SQL editor or psql to run `migrations/20260130_public_views_and_file_rbac.sql`.

6) Rollback
- Re-grant SELECT as shown above, or restore DB from backup.
