#!/usr/bin/env node
/**
 * scripts/test_sample_files.cjs
 *
 * Quick helper to validate that specific sample rows are visible via `public_post_files`
 * and that their storage objects can be signed via `createSignedUrl`.
 *
 * Usage:
 *  SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_KEY=<service-role-key> SUPABASE_ANON_KEY=<anon-key> node scripts/test_sample_files.cjs
 *
 * If you provide only SUPABASE_SERVICE_KEY the script will still attempt signed-url checks.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Require SUPABASE_URL and SUPABASE_SERVICE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const samples = [
  {
    id: '974e528d-f8c1-4a28-8119-c69010c98236',
    bucket: 'post-files',
    object_path: '85346f06-bcb9-4ff4-b91d-e8c34eec9f05/9cba56ae-c671-4fbd-b4e4-2278303f13d9/1769618887736_Tentative_Agreement_Info.pdf'
  },
  {
    id: 'a82e4dd3-265a-4be8-8621-b37fff9f70e8',
    bucket: 'post-files',
    object_path: '85346f06-bcb9-4ff4-b91d-e8c34eec9f05/9cba56ae-c671-4fbd-b4e4-2278303f13d9/1769620064393_Email_01_28_2026.pdf'
  },
  {
    id: '046480b8-6f03-4a53-9bc3-0df8fae4e219',
    bucket: 'post-files',
    object_path: '85346f06-bcb9-4ff4-b91d-e8c34eec9f05/fa71c80a-e2c4-403b-965c-41206694b3ff/1769625606404_Mark_Derrig_Bribery_Allegation_Opinion_Final.pdf'
  },
  {
    id: '435e69b8-d7ce-4c00-9def-4f6a27f927c4',
    bucket: 'post-files',
    object_path: '85346f06-bcb9-4ff4-b91d-e8c34eec9f05/bfd7fb00-3384-4cc8-9321-793ff2c06c28/1769734148458_twu__akron_-_responsibility_v5-1080p.mp4'
  }
];

async function checkViewRowWithAnon(id) {
  if (!SUPABASE_ANON_KEY) return { ok: null, msg: 'no anon key provided' };
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error, status } = await anon.from('public_post_files').select('*').eq('id', id).limit(1).maybeSingle();
  if (error) return { ok: false, msg: `${error.message || String(error)} (status ${status})` };
  return { ok: !!data, msg: data ? 'found' : 'not found' };
}

async function trySignedUrl(bucket, object_path) {
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(object_path, 60);
    if (error) return { ok: false, msg: error.message || String(error) };
    if (!data || !data.signedURL) return { ok: false, msg: 'no signed url returned' };
    return { ok: true, url: data.signedURL };
  } catch (err) {
    return { ok: false, msg: err?.message || String(err) };
  }
}

async function main() {
  console.log('Testing sample file rows...');
  for (const s of samples) {
    process.stdout.write(`- id=${s.id} `);
    if (SUPABASE_ANON_KEY) {
      const r = await checkViewRowWithAnon(s.id);
      process.stdout.write(`view=${r.ok === null ? 'skipped' : r.ok ? 'visible' : 'not-visible'} `);
    } else {
      process.stdout.write('view=skipped ');
    }
    const su = await trySignedUrl(s.bucket, s.object_path);
    if (su.ok) {
      console.log('signed_url=OK');
    } else {
      console.log(`signed_url=ERR (${su.msg})`);
    }
  }
  console.log('\nDone.');
}

main().catch(err => { console.error('Error:', err); process.exit(2); });
