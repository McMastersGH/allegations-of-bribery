-- DB inspection queries for use in Supabase SQL editor or psql
-- Run as an admin/service role to see full details (policies/grants/owners).

-- 1) List non-system schemas
SELECT nspname
FROM pg_namespace
WHERE nspname NOT IN ('pg_catalog','information_schema')
ORDER BY nspname;

-- 2) List all tables and views
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY table_schema, table_name;

-- 3) List columns for every table/view
SELECT table_schema, table_name, ordinal_position, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY table_schema, table_name, ordinal_position;

-- 4) Show constraints (PK / FK / CHECK / UNIQUE)
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_namespace n ON c.connamespace = n.oid
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY table_name;

-- 5) Show indexes
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename;

-- 6) Show triggers
SELECT event_object_schema, event_object_table, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema NOT IN ('pg_catalog','information_schema')
ORDER BY event_object_schema, event_object_table;

-- 7) List functions (with full definition)
SELECT n.nspname AS schema, p.proname AS name, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname NOT IN ('pg_catalog','information_schema')
ORDER BY schema, name;

-- 8) Show which tables have RLS enabled
SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND c.relkind = 'r'
ORDER BY schema, table_name;

-- 9) List row-level policies (all)
SELECT pol.polname AS policy_name,
       pol.polrelid::regclass AS table_name,
       pol.polcmd AS cmd,
       pol.polpermissive AS permissive,
       pol.polroles AS roles,
       pg_get_expr(pol.polqual, pol.polrelid) AS using_qual,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
FROM pg_policy pol
ORDER BY table_name, policy_name;

-- 10) View policies for one specific table (replace schema.table)
-- Example: public.comments
SELECT pol.polname, pol.polrelid::regclass AS table_name, pol.polcmd,
       pol.polroles, pg_get_expr(pol.polqual, pol.polrelid) AS using_qual,
       pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check
FROM pg_policy pol
WHERE pol.polrelid = 'public.comments'::regclass;

-- 11) List grants (table-level privileges)
SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY table_schema, table_name, grantee;

-- 12) List roles and membership info
SELECT rolname, rolsuper, rolcreaterole, rolcanlogin
FROM pg_roles
ORDER BY rolname;

-- 13) Show table owners
SELECT n.nspname AS schema, c.relname AS table_name, r.rolname AS owner
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_roles r ON c.relowner = r.oid
WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND c.relkind = 'r'
ORDER BY schema, table_name;

-- NOTE: Run the above blocks as a privileged user to see full details (policies, owners, grants).
-- Save or share the results as needed. Use `\o filename` in psql to write output to a file.
