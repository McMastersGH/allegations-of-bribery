#!/usr/bin/env node
// scripts/create-authors.js
// Upsert sample authors into the `authors` table using anon key from js/supabaseClient.js
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const ROOT = process.cwd();
const sbFile = path.join(ROOT, 'js', 'supabaseClient.js');
if (!fs.existsSync(sbFile)) {
  console.error('supabaseClient.js not found at', sbFile);
  process.exit(1);
}
const txt = fs.readFileSync(sbFile, 'utf8');
const urlMatch = txt.match(/export const SUPABASE_URL\s*=\s*"([^"]+)"/);
const keyMatch = txt.match(/export const SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/);
if (!urlMatch || !keyMatch) {
  console.error('Could not parse SUPABASE_URL or SUPABASE_ANON_KEY from js/supabaseClient.js');
  process.exit(1);
}
const SUPABASE_URL = urlMatch[1];
const SUPABASE_ANON_KEY = keyMatch[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

async function run() {
  try {
    // Known author id from existing posts
    const existingAuthorId = '85346f06-bcb9-4ff4-b91d-e8c34eec9f05';
    const randomId = crypto.randomUUID();

    const authors = [
      {
        user_id: existingAuthorId,
        display_name: 'DMcMasters',
        approved: true,
        is_anonymous: false,
      },
      {
        user_id: randomId,
        display_name: 'SampleAuthor',
        approved: false,
        is_anonymous: false,
      },
    ];

    console.log('Upserting authors:', authors.map(a => ({ user_id: a.user_id, display_name: a.display_name })));

    const { data, error } = await supabase.from('authors').upsert(authors, { onConflict: 'user_id' });
    if (error) {
      console.error('Upsert error:', error);
      process.exit(1);
    }

    console.log('Upsert result:', data);
    process.exit(0);
  } catch (e) {
    console.error('Exception:', e);
    process.exit(1);
  }
}

run();
