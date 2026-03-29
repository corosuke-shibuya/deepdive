# DeepDive Security Audit Report

**Date:** March 29, 2026
**Project:** DeepDive - AI Communication Analysis Platform
**Status:** SECURITY ISSUES IDENTIFIED AND PARTIALLY FIXED

---

## Executive Summary

The DeepDive project had several critical security issues that have been addressed:

1. ✅ **FIXED:** Missing security headers in Vercel configuration
2. ✅ **FIXED:** Missing JWT authentication on API endpoints
3. ⚠️ **NEEDS CONFIG:** Row Level Security (RLS) configuration in Supabase
4. ✅ **OK:** Supabase credentials properly managed via API endpoint
5. ⚠️ **NEEDS CONFIG:** Supabase authentication settings

---

## Security Audit Details

### 1. Security Headers ✅ FIXED

**Issue:** Missing HTTP security headers to prevent clickjacking, MIME sniffing, and other attacks.

**Fix Applied:** Updated `vercel.json` with comprehensive security headers:
- `X-Frame-Options: DENY` - Prevents clickjacking attacks
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information leakage
- `Content-Security-Policy` - Restricts resource loading to trusted sources
- `Strict-Transport-Security` - Enforces HTTPS
- `X-Permitted-Cross-Domain-Policies: none` - Prevents cross-domain policy loading

**File Modified:** `/sessions/festive-quirky-shannon/mnt/deepdive/vercel.json`

---

### 2. API Authentication ✅ FIXED

**Issue:** API endpoints (`/api/analyze`, `/api/participant`, `/api/meeting-prep`, `/api/myprofile`) did not verify that requests came from authenticated users.

**Risk Level:** CRITICAL - Unauthenticated attackers could access the API and consume resources.

**Fix Applied:**
1. Created `verifyAuth()` function in `api/_lib.js` to validate JWT tokens from the Authorization header
2. Updated all four API endpoints to call `verifyAuth()` before processing requests
3. JWT verification validates Supabase authentication tokens using the SUPABASE_JWT_SECRET environment variable

**Files Modified:**
- `/sessions/festive-quirky-shannon/mnt/deepdive/api/_lib.js` - Added `verifyAuth()` function
- `/sessions/festive-quirky-shannon/mnt/deepdive/api/analyze.js` - Added auth verification
- `/sessions/festive-quirky-shannon/mnt/deepdive/api/participant.js` - Added auth verification
- `/sessions/festive-quirky-shannon/mnt/deepdive/api/meeting-prep.js` - Added auth verification
- `/sessions/festive-quirky-shannon/mnt/deepdive/api/myprofile.js` - Added auth verification

**How It Works:**
```javascript
// Client sends requests with Authorization header
Authorization: Bearer <jwt_token>

// Server verifies the token and extracts user identity
const user = await verifyAuth(req);
// user.sub = user ID
// user.email = user email
```

---

### 3. Supabase Configuration ⚠️ NEEDS MANUAL ACTION

#### A. Row Level Security (RLS) - Already Implemented ✅

The `supabase-schema.sql` file includes proper RLS policies:

**Existing Policies:**
- `meetings: own data only` - Users can only see their own meeting analyses
- `persons: own data only` - Users can only see their own participant profiles
- `myprofile_cache: own data only` - Users can only see their own cached profile

**Status:** RLS is already defined in the schema file. Verify it's enabled in your Supabase dashboard.

#### B. Environment Variables - REQUIRED ⚠️

The following environment variables must be set in your Vercel deployment:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase
ANTHROPIC_API_KEY=sk-ant-...
```

**How to Find These Values:**

1. **SUPABASE_URL & SUPABASE_ANON_KEY:**
   - Go to Supabase Dashboard → Settings → API
   - Copy "Project URL" → SUPABASE_URL
   - Copy "anon public" key → SUPABASE_ANON_KEY

2. **SUPABASE_JWT_SECRET:**
   - Go to Supabase Dashboard → Settings → API
   - Copy "JWT Secret" → SUPABASE_JWT_SECRET
   - ⚠️ CRITICAL: Never commit this to version control!

3. **ANTHROPIC_API_KEY:**
   - Get from your Anthropic API account
   - ⚠️ CRITICAL: Never commit this to version control!

---

### 4. Supabase Credentials Exposure ✅ OK

**Finding:** The frontend retrieves Supabase credentials from `/api/config` endpoint instead of hardcoding them.

**Status:** ✅ SECURE - Public Supabase credentials (URL and anon key) are returned from the API endpoint, which is the correct approach. The anon key is intentionally public and limited in scope by Supabase RLS.

---

### 5. No Hardcoded Secrets ✅ OK

**Finding:** No `.env` files found in the repository. All secrets are managed via environment variables in Vercel.

**Status:** ✅ SECURE - Following best practices.

---

### 6. API Key Protection ✅ OK

**Finding:** ANTHROPIC_API_KEY is only used in server-side code (`api/_lib.js`), never exposed to the client.

**Status:** ✅ SECURE - API calls to Anthropic are made from the backend.

---

## Recommended Additional Security Measures

### 1. Rate Limiting (Medium Priority)
Consider implementing rate limiting on API endpoints to prevent abuse:
- Limit requests per authenticated user
- Implement backoff strategy for Anthropic API

### 2. Input Validation (High Priority)
Enhance input validation in API endpoints:
```javascript
// Example for analyze.js
if (!meeting_log || meeting_log.trim().length < 20) {
  return res.status(400).json({ error: '会議ログが短すぎます' });
}
// Add length limits to prevent DoS
if (meeting_log.length > 50000) {
  return res.status(400).json({ error: '会議ログが長すぎます' });
}
```

### 3. CORS Refinement (Medium Priority)
Current CORS allows any origin (`Access-Control-Allow-Origin: *`). Consider restricting to your domain:
```javascript
// In _lib.js
function cors(res, allowedOrigin = process.env.ALLOWED_ORIGIN || '*') {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  // ... rest of CORS headers
}
```

### 4. SQL Injection Prevention (Already OK)
All database operations use Supabase client library with parameterized queries. No direct SQL is constructed from user input. ✅

### 5. Session Management (Configure in Supabase)
In Supabase Dashboard → Authentication → Providers:
- Set JWT expiration to reasonable value (e.g., 1 hour)
- Enable "Auto confirm users" only if intentional
- Configure email verification requirements

---

## Deployment Checklist

### Before Production Deployment:

- [ ] Set all required environment variables in Vercel:
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_ANON_KEY
  - [ ] SUPABASE_JWT_SECRET
  - [ ] ANTHROPIC_API_KEY

- [ ] Verify RLS policies are enabled in Supabase:
  ```sql
  SELECT tablename FROM pg_tables WHERE schemaname = 'public';
  SELECT * FROM pg_policies WHERE tablename IN ('meetings', 'persons', 'myprofile_cache');
  ```

- [ ] Test authentication flow:
  - Sign up new user
  - Verify JWT token is issued
  - Verify API endpoints require Authorization header
  - Verify unauthenticated requests return 401

- [ ] Enable HTTPS enforcement:
  - Vercel automatically enforces HTTPS ✅
  - Check Strict-Transport-Security header is present ✅

- [ ] Review Supabase authentication settings:
  - [ ] Email confirmations enabled
  - [ ] Password requirements set
  - [ ] MFA optional/required (your choice)

---

## Security Headers Summary

The updated `vercel.json` now includes:

| Header | Value | Purpose |
|--------|-------|---------|
| X-Frame-Options | DENY | Prevents clickjacking |
| X-Content-Type-Options | nosniff | Prevents MIME sniffing |
| Referrer-Policy | strict-origin-when-cross-origin | Limits referrer leakage |
| Content-Security-Policy | Restricted policy | Prevents XSS, limits resource loading |
| Strict-Transport-Security | max-age=31536000 | Enforces HTTPS |
| X-Permitted-Cross-Domain-Policies | none | Prevents cross-domain policies |

---

## API Authentication Implementation

All protected endpoints now follow this pattern:

```javascript
const { verifyAuth } = require('./_lib');

module.exports = async function(req, res) {
  try {
    // 1. Verify user is authenticated
    const user = await verifyAuth(req);

    // 2. Extract request body
    const { /* parameters */ } = req.body || {};

    // 3. Validate input
    // ... validation code ...

    // 4. Process request (user is guaranteed to be authenticated)
    const data = await callAnthropic(prompt);

    // 5. Return response
    return res.json({ success: true, data });

  } catch(e) {
    return res.status(e.message.includes('認証') ? 401 : 500)
      .json({ error: e.message });
  }
};
```

---

## Testing Authentication

### Manual Test with curl:

```bash
# Without token - should get 401
curl -X POST https://your-app.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"meeting_log":"test"}'

# With invalid token - should get 401
curl -X POST https://your-app.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid_token" \
  -d '{"meeting_log":"test"}'

# With valid token - should process
curl -X POST https://your-app.vercel.app/api/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <valid_jwt_from_supabase>" \
  -d '{"meeting_log":"test meeting log..."}'
```

---

## Files Modified

1. **vercel.json** - Added comprehensive security headers
2. **api/_lib.js** - Added JWT verification utility
3. **api/analyze.js** - Added authentication check
4. **api/participant.js** - Added authentication check
5. **api/meeting-prep.js** - Added authentication check
6. **api/myprofile.js** - Added authentication check

---

## Conclusion

The DeepDive project now has:
- ✅ Security headers preventing common web attacks
- ✅ API endpoint authentication preventing unauthorized access
- ✅ Row Level Security (RLS) policies protecting user data in Supabase
- ✅ Proper secret management through environment variables
- ✅ No exposed API keys in client-side code

**Next Steps:** Deploy the fixes to Vercel and configure the required environment variables in your Vercel project settings.
