-- migrations/seed_forums.sql
-- Inserts common forum rows used by the UI. Run in the Supabase SQL editor
-- or via psql/supabase CLI. Uses ON CONFLICT to be safe to re-run.

INSERT INTO forums (slug, title, description) VALUES
  ('general-topics', 'General Topics', 'Open discussion of allegations, investigations, and site updates.'),
  ('union-matters', 'Union Matters', 'Discuss union organizing, labor disputes, contracts, and member issues.'),
  ('questions-and-answers', 'Questions & Answers', 'Ask for clarification, document analysis, and procedural guidance.'),
  ('off-topic', 'Off-topic', 'Anything not directly related to cases, filings, or records.'),
  ('bribery-allegations', 'Bribery Allegations', 'Discuss specific bribery allegations.'),
  ('judicial-misconduct', 'Judicial Misconduct', 'Case tracking, timelines, and sourced documentation for court conduct.'),
  ('public-records', 'Public Records', 'Requests, responses, and document dumps organized by agency and date.')
ON CONFLICT (slug) DO UPDATE
  SET title = EXCLUDED.title,
      description = EXCLUDED.description;

-- Optional: verify rows
-- SELECT slug, title FROM forums WHERE slug IN (
--   'general-topics','introductions','questions-and-answers','off-topic','bribery-allegations','judicial-misconduct','public-records'
-- );
