/*
Simple checks for public views vs table access using PostgREST endpoints.
Usage:
  node scripts/test_public_views.cjs
Requires env:
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY (optional, for verifying service-role access)

This script makes direct HTTP calls to the Supabase PostgREST endpoints so
it doesn't require additional packages (Node 18+ with global fetch).
*/

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in the environment.');
  process.exit(2);
}

async function call(endpoint, key) {
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/${endpoint}`;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  };
  try {
    const res = await fetch(url, { headers, method: 'GET' });
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch (e) { body = text; }
    return { status: res.status, ok: res.ok, body };
  } catch (e) {
    return { status: 0, ok: false, body: String(e) };
  }
}

(async () => {
  console.log('Testing as ANON user (using SUPABASE_ANON_KEY)...');
  console.log('Checking public_posts view...');
  let r = await call('public_posts?select=*&limit=1', SUPABASE_ANON_KEY);
  console.log('public_posts ->', r.status, r.ok);
  if (r.ok) console.log('  sample:', JSON.stringify(r.body, null, 2));

  console.log('\nChecking posts table (should fail for anon after migration)...');
  r = await call('posts?select=id,author_id&limit=1', SUPABASE_ANON_KEY);
  console.log('posts ->', r.status, r.ok);
  console.log('  body:', JSON.stringify(r.body));

  console.log('\nChecking public_post_files view...');
  r = await call('public_post_files?select=*&limit=1', SUPABASE_ANON_KEY);
  console.log('public_post_files ->', r.status, r.ok);
  if (r.ok) console.log('  sample:', JSON.stringify(r.body, null, 2));

  console.log('\nChecking post_files table (should fail for anon after migration)...');
  r = await call('post_files?select=bucket,object_path&limit=1', SUPABASE_ANON_KEY);
  console.log('post_files ->', r.status, r.ok);
  console.log('  body:', JSON.stringify(r.body));

  if (SUPABASE_SERVICE_ROLE_KEY) {
    console.log('\nTesting as SERVICE ROLE (service key provided)...');
    r = await call('post_files?select=id,bucket,object_path,original_name&limit=1', SUPABASE_SERVICE_ROLE_KEY);
    console.log('post_files (service) ->', r.status, r.ok);
    if (r.ok) console.log('  sample:', JSON.stringify(r.body, null, 2));
  } else {
    console.log('\nNo SUPABASE_SERVICE_ROLE_KEY provided; skipping service-role checks.');
  }

  console.log('\nDone. Interpret results: anon should be able to query the public_* views but should NOT be able to read sensitive columns from underlying tables.');
})();
