import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ovsshqgcfucwzcgqltes.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('ERROR: set SUPABASE_SERVICE_ROLE_KEY in the environment to run this script.');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function listAllUsers() {
  const all = [];
  let page = 1;
  const per_page = 100;
  while (true) {
    const res = await sb.auth.admin.listUsers({ page, per_page });
    if (res.error) throw res.error;
    const users = res.users || [];
    all.push(...users);
    if (!res.pagination || !res.pagination.next) break;
    page = res.pagination.next;
  }
  return all;
}

async function run() {
  console.log('Listing all users (this requires a service role key)...');
  const users = await listAllUsers();
  console.log(`Fetched ${users.length} users.`);

  let updatedPosts = 0;
  let upsertedAuthors = 0;

  for (const u of users) {
    const name = (u.user_metadata && (u.user_metadata.display_name || u.user_metadata.full_name)) || null;
    if (!name) continue;

    // Upsert authors row so future posts already have display_name available
    try {
      const { error: aErr } = await sb.from('authors').upsert(
        { user_id: u.id, display_name: name, approved: false, is_anonymous: false },
        { onConflict: 'user_id' }
      );
      if (!aErr) upsertedAuthors++;
    } catch (e) {
      console.warn('authors upsert failed for', u.id, e && e.message ? e.message : e);
    }

    // Update posts where display_name is null
    try {
      const { error: pErr } = await sb
        .from('posts')
        .update({ display_name: name })
        .eq('author_id', u.id)
        .is('display_name', null);
      if (!pErr) updatedPosts++;
    } catch (e) {
      console.warn('posts update failed for', u.id, e && e.message ? e.message : e);
    }
  }

  console.log(`Done. Upserted authors for ~${upsertedAuthors} users, updated posts for ~${updatedPosts} authors.`);
}

run().catch((e) => {
  console.error('Fatal error:', e && e.message ? e.message : e);
  process.exit(2);
});
