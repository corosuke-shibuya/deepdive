// =============================================
// api/auth/zoom/callback.js
// Zoom OAuth コールバック処理
// GET /api/auth/zoom/callback?code=...&state=...
// =============================================
const crypto = require('crypto');

function verifyState(stateParam) {
  let decoded;
  try {
    decoded = Buffer.from(stateParam, 'base64url').toString('utf8');
  } catch {
    throw new Error('不正なstateパラメータ');
  }

  const parts = decoded.split(':');
  if (parts.length !== 3) throw new Error('stateの形式が不正');
  const [userId, timestamp, sig] = parts;

  if (Date.now() - Number(timestamp) > 10 * 60 * 1000) {
    throw new Error('stateの有効期限切れ');
  }

  const expected = crypto
    .createHmac('sha256', process.env.ZOOM_STATE_SECRET)
    .update(`${userId}:${timestamp}`)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('stateの署名が不正');
  }
  return userId;
}

async function exchangeCode(code) {
  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.BASE_URL}/api/auth/zoom/callback`,
    }),
  });
  if (!res.ok) throw new Error(`トークン交換失敗: ${await res.text()}`);
  return res.json();
}

async function getZoomUser(accessToken) {
  const res = await fetch('https://api.zoom.us/v2/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Zoomユーザー情報取得失敗');
  return res.json();
}

async function saveIntegration(userId, tokens, zoomUser) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const res = await fetch(`${supabaseUrl}/rest/v1/user_integrations`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      user_id: userId,
      provider: 'zoom',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope,
      metadata: {
        zoom_user_id: zoomUser.id,
        zoom_account_id: zoomUser.account_id,
        zoom_email: zoomUser.email,
      },
    }),
  });
  if (!res.ok) throw new Error(`DB保存失敗: ${await res.text()}`);
}

module.exports = async function handler(req, res) {
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    return res.redirect(`${process.env.BASE_URL}/?integration=zoom&status=cancelled`);
  }
  if (!code || !state) {
    return res.status(400).json({ error: 'codeまたはstateが不足しています' });
  }

  let userId;
  try {
    userId = verifyState(state);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const tokens = await exchangeCode(code);
    const zoomUser = await getZoomUser(tokens.access_token);
    await saveIntegration(userId, tokens, zoomUser);
  } catch (err) {
    console.error('Zoom callback エラー:', err);
    return res.redirect(`${process.env.BASE_URL}/?integration=zoom&status=error`);
  }

  res.redirect(`${process.env.BASE_URL}/?integration=zoom&status=success`);
};
