#!/usr/bin/env node
// scripts/create-bucket.js
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-bucket.js <bucket-name>

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketArg = process.argv[2];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
  process.exit(1);
}

const bucket = bucketArg || process.env.BUCKET_NAME || 'uploads';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
  try {
    console.log(`Creating bucket: ${bucket}`);
    const { data, error } = await supabase.storage.createBucket(bucket, { public: true });
    if (error) {
      // If the bucket exists you'll get an error; surface it but exit 0 if it's already there
      if (error.message && error.message.includes('Bucket already exists')) {
        console.log(`Bucket already exists: ${bucket}`);
        process.exit(0);
      }
      console.error('Error creating bucket:', error.message || error);
      process.exit(2);
    }
    console.log('Bucket created:', data);
    process.exit(0);
  } catch (e) {
    console.error('Unexpected error:', e?.message || e);
    process.exit(3);
  }
}

main();
