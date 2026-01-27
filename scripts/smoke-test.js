// scripts/smoke-test.js
// Lightweight API-only smoke test that verifies Supabase queries used by the site.
// Exits with code 0 on success, non-zero on any failure.

import { createClient } from "@supabase/supabase-js";

// Keep these in sync with js/supabaseClient.js
const SUPABASE_URL = "https://ovsshqgcfucwzcgqltes.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Py3GBxpFjqUm-RMYdOiTXA_1-PAFtRX";

const slugs = [
	"general-topics",
	"introductions",
	"questions-and-answers",
	"off-topic",
	"judicial-misconduct",
	"public-records",
];

async function run() {
	const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: { persistSession: false }
	});

	const summary = {};

	for (const slug of slugs) {
		// Helper: retry async function `fn` up to `attempts` times with `delayMs` backoff.
		async function retry(fn, attempts = 3, delayMs = 500) {
			let lastErr;
			for (let i = 0; i < attempts; i++) {
				try {
					return await fn();
				} catch (e) {
					lastErr = e;
					const wait = delayMs * Math.pow(2, i);
					console.warn(`attempt ${i + 1} failed — retrying in ${wait}ms:`, e.message || e);
					await new Promise((r) => setTimeout(r, wait));
				}
			}
			throw lastErr;
		}

		try {
			// Get thread (posts) count for published posts in the forum
			const postRes = await retry(() => sb
				.from("posts")
				.select("id", { count: "exact", head: true })
				.eq("forum_slug", slug)
				.eq("status", "published"), 3, 400);

			if (postRes.error) throw postRes.error;
			const threadCount = postRes.count ?? 0;

			// Fetch ids (limited) to count comments - best-effort only
			const idsRes = await retry(() => sb
				.from("posts")
				.select("id")
				.eq("forum_slug", slug)
				.eq("status", "published")
				.limit(1000), 3, 400);

			if (idsRes.error) throw idsRes.error;
			const postIds = (idsRes.data || []).map((r) => r.id).filter(Boolean);

			let commentCount = 0;
			if (postIds.length > 0) {
				const cRes = await retry(() => sb
					.from("comments")
					.select("id", { count: "exact", head: true })
					.in("post_id", postIds), 3, 400);
				if (cRes.error) throw cRes.error;
				commentCount = cRes.count ?? 0;
			}

			summary[slug] = { threads: threadCount, comments: commentCount };
			console.log(`ok: ${slug} -> threads=${threadCount}, comments=${commentCount}`);
		} catch (e) {
			console.error(`error for ${slug}:`, e && e.message ? e.message : String(e));
			process.exitCode = 2;
			summary[slug] = { error: String(e) };
		}
	}

	console.log("summary:", JSON.stringify(summary, null, 2));
	if (process.exitCode && process.exitCode !== 0) {
		console.error("smoke test failed");
		process.exit(2);
	}
	console.log("smoke test passed");
}

run().catch((e) => {
	console.error("unhandled error:", e);
	process.exit(3);
});
