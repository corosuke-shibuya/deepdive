// =============================================
// api/auth/zoom/start.js
// Zoom OAuth 認証フローの開始
// GET /api/auth/zoom/start?token=<supabase_jwt>
// =============================================
const crypto = require('crypto');
const { verifyAuth, cors, AuthError } = require('../../_lib');

const ZOOM_SCOPES = [
  'cloud_recording:read:meeting_transcript',
  'user:read:user',
].join(' ');

function createState(userId) {
  const payload = `${userId}:${Date.now()}`;
  const sig = crypto
    .createHmac('sha256', process.env.ZOOM_STATE_SECRET)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // フロントエンドから ?token=<supabase_jwt> で渡す
  // (OAuthリダイレクトなのでAuthorizationヘッダーが使えないため)
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'tokenが必要です' });

  // _lib.js の verifyAuth はヘッダーから読むので、ここは直接Supabaseで検証
  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEYS;

  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  });
  if (!resp.ok) return res.status(401).json({ error: '認証エラー' });
  const user = await resp.json();
  if (!user?.id) return res.status(401).json({ error: 'ユーザー情報取得失敗' });

  const state = createState(user.id);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.ZOOM_CLIENT_ID,
    redirect_uri: `${process.env.BASE_URL}/api/auth/zoom/callback`,
    scope: ZOOM_SCOPES,
    state,
  });

  res.redirect(`https://zoom.us/oauth/authorize?${params.toString()}`);
};
