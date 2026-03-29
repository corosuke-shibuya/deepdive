-- ============================================================
-- Deep Dive - RLS Verification & Maintenance Queries
-- Run these in Supabase SQL Editor to verify security
-- ============================================================

-- 1. VERIFY RLS IS ENABLED ON ALL TABLES
-- Expected output: All tables should show 'true' for rls_enabled
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('meetings', 'persons', 'myprofile_cache')
ORDER BY tablename;

-- 2. VIEW ALL SECURITY POLICIES
-- This shows all RLS policies protecting your tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual AS policy_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('meetings', 'persons', 'myprofile_cache')
ORDER BY tablename, policyname;

-- 3. VERIFY INDEXES FOR PERFORMANCE
-- These indexes should exist for optimal query performance
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('meetings', 'persons', 'myprofile_cache')
ORDER BY tablename, indexname;

-- 4. CHECK USER ROLES AND PERMISSIONS
-- Verify that public role has correct access
SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('meetings', 'persons', 'myprofile_cache')
ORDER BY table_name, grantee;

-- ============================================================
-- RLS POLICIES REFERENCE (For Documentation)
-- ============================================================

-- Policy 1: meetings - Users can only read/write their own records
-- CREATE POLICY "meetings: own data only"
--   ON meetings FOR ALL
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);

-- Policy 2: persons - Users can only read/write their own participant profiles
-- CREATE POLICY "persons: own data only"
--   ON persons FOR ALL
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);

-- Policy 3: myprofile_cache - Users can only read/write their own profile
-- CREATE POLICY "myprofile_cache: own data only"
--   ON myprofile_cache FOR ALL
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TESTING SECURITY POLICIES
-- ============================================================

-- Test 1: As authenticated user, you should see only your records
-- Run this as the authenticated user to verify you see data
SELECT id, user_id, title, created_at FROM meetings LIMIT 10;

-- Test 2: Try to access another user's data
-- This query will return no results if RLS is working correctly
-- (substitute 'other-user-uuid' with an actual different user's ID)
-- SELECT * FROM meetings WHERE user_id = 'other-user-uuid';
-- Expected: 0 rows (RLS prevents access)

-- Test 3: Check data isolation
-- Count records by user
SELECT user_id, COUNT(*) as record_count FROM meetings GROUP BY user_id;

-- ============================================================
-- PERFORMANCE MONITORING
-- ============================================================

-- Check table sizes (useful for monitoring growth)
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('meetings', 'persons', 'myprofile_cache')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================
-- RECOMMENDED SUPABASE DASHBOARD CONFIGURATION
-- ============================================================

-- Navigate to: Supabase Dashboard → Authentication → Providers
-- Recommended Settings:

-- Email Provider:
-- - Enable Email Confirmations: YES (recommended)
-- - Auto-confirm users: NO (require email verification)
-- - Confirmation Email: (use default or customize)
-- - Change Email Confirmation: YES

-- Password Requirements:
-- - Minimum Password Length: 8-12 characters
-- - Require uppercase letters: Recommended
-- - Require numbers: Recommended
-- - Require special characters: Optional

-- JWT Settings (Settings → API → JWT Settings):
-- - JWT Secret: (Generate in Supabase if not exists)
-- - JWT Expiration: 3600 seconds (1 hour) - Recommended
-- - Refresh Token Expiration: 2592000 seconds (30 days) - Recommended

-- MFA (Multi-Factor Authentication):
-- - Optional (user can enable)
-- - Or Required (all users must enable) - Your choice

-- ============================================================
-- EMERGENCY: DISABLE/RE-ENABLE RLS (USE WITH CAUTION)
-- ============================================================

-- WARNING: Only run if RLS is broken and needs emergency access
-- This temporarily disables security - re-enable immediately after!

-- Disable RLS (EMERGENCY ONLY):
-- ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE persons DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE myprofile_cache DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS (must do after emergency):
-- ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE myprofile_cache ENABLE ROW LEVEL SECURITY;
