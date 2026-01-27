import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ovsshqgcfucwzcgqltes.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Py3GBxpFjqUm-RMYdOiTXA_1-PAFtRX";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function run() {
  // Fetch recent posts
  const { data: posts, error: postErr } = await sb
    .from('posts')
    .select('id, title, author_id, display_name, is_anonymous, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  if (postErr) throw postErr;

  const missingAuthorIds = [...new Set((posts || []).filter(p => !p?.display_name).map(p => p.author_id).filter(Boolean))];

  let authorsMap = {};
  if (missingAuthorIds.length) {
    const { data: authorsData, error: authorsErr } = await sb
      .from('authors')
      .select('user_id, display_name')
      .in('user_id', missingAuthorIds);
    if (authorsErr) throw authorsErr;
    authorsMap = Object.fromEntries((authorsData || []).map(a => [a.user_id, a.display_name]));
  }

  console.log('Recent posts (computed display_name):');
  for (const p of posts || []) {
    const display_name = p.is_anonymous ? 'Anonymous' : (p.display_name || authorsMap[p.author_id] || 'Member');
    console.log(`- id=${p.id} title="${p.title || ''}" stored_display_name=${p.display_name} author_id=${p.author_id} is_anonymous=${p.is_anonymous} -> display_name=${display_name}`);
  }

  if (!posts || posts.length === 0) return;

  const firstPostId = posts[0].id;
  const { data: comments, error: commentsErr } = await sb
    .from('comments')
    .select('id, body, display_name, is_anonymous, created_at')
    .eq('post_id', firstPostId)
    .order('created_at', { ascending: true });
  if (commentsErr) throw commentsErr;

  console.log(`\nComments for post id=${firstPostId}:`);
  for (const c of comments || []) {
    const d = c.is_anonymous ? 'Anonymous' : (c.display_name || 'Member');
    console.log(`- id=${c.id} is_anonymous=${c.is_anonymous} stored_display_name=${c.display_name} -> computed=${d} body="${(c.body||'').slice(0,60).replace(/\n/g,' ')}"`);
  }
}

run().catch(e => {
  console.error('error:', e && e.message ? e.message : e);
  process.exit(2);
});
