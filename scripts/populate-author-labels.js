import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ovsshqgcfucwzcgqltes.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Py3GBxpFjqUm-RMYdOiTXA_1-PAFtRX";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function run() {
  // Find posts missing display_name
  const { data: posts, error: postsErr } = await sb
    .from('posts')
    .select('id, author_id')
    .is('display_name', null)
    .limit(1000);
  if (postsErr) throw postsErr;

  const authorIds = [...new Set((posts || []).map(p => p.author_id).filter(Boolean))];
  if (!authorIds.length) {
    console.log('No posts missing display_name found.');
    return;
  }

  console.log(`Found ${posts.length} posts missing display_name for ${authorIds.length} authors.`);

  // Fetch authors with display_name
  const { data: authors, error: authorsErr } = await sb
    .from('authors')
    .select('user_id, display_name')
    .in('user_id', authorIds)
    .not('display_name', 'is', null);
  if (authorsErr) throw authorsErr;

  const authorsMap = Object.fromEntries((authors || []).map(a => [a.user_id, a.display_name]));

  let updated = 0;
  for (const [userId, displayName] of Object.entries(authorsMap)) {
    const { error: upErr } = await sb
      .from('posts')
      .update({ display_name: displayName })
      .eq('author_id', userId)
      .is('display_name', null);
    if (upErr) {
      console.error('Failed to update posts for author', userId, upErr.message || upErr);
    } else {
      updated++;
      console.log(`Updated posts for author ${userId} -> "${displayName}"`);
    }
  }

  console.log(`Done. Authors with display_name applied: ${updated}`);
}

run().catch(e => {
  console.error('Error:', e && e.message ? e.message : e);
  process.exit(2);
});
