// =============================================
// api/webhooks/zoom.js
// Zoom Webhook 受信ハンドラ
// POST /api/webhooks/zoom
// =============================================
const crypto = require('crypto');

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, timestamp, signature) {
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 30) {
    throw new Error('タイムスタンプが古すぎます');
  }
  const message = `v0:${timestamp}:${rawBody.toString()}`;
  const expected = 'v0=' + crypto
    .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET)
    .update(message)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('署名が不正です');
  }
}

function parseVtt(vttContent) {
  return vttContent
    .split('\n')
    .filter(line => {
      const t = line.trim();
      return t && t !== 'WEBVTT' && !/^\d+$/.test(t) && !/-->/i.test(t);
    })
    .join('\n');
}

async function refreshToken(integration) {
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
      grant_type: 'refresh_token',
      refresh_token: integration.refresh_token,
    }),
  });
  if (!res.ok) throw new Error('トークンリフレッシュ失敗');
  const tokens = await res.json();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  await fetch(`${supabaseUrl}/rest/v1/user_integrations?id=eq.${integration.id}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }),
  });
  return tokens.access_token;
}

async function processTranscript(payload) {
  const { object } = payload;
  const hostId = object.host_id;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`[zoom-webhook] transcript受信 host_id=${hostId} topic=${object.topic}`);

  // zoom_user_id から user_integration を引く
  const intRes = await fetch(
    `${supabaseUrl}/rest/v1/user_integrations?provider=eq.zoom&select=*`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );
  const allIntegrations = await intRes.json();
  console.log(`[zoom-webhook] user_integrations件数=${allIntegrations?.length} host_id=${hostId}`);

  // メモリ上でzoom_user_idを照合（JSONB queryの代替）
  const integrations = (allIntegrations || []).filter(
    i => i.metadata?.zoom_user_id === hostId
  );

  if (!integrations?.length) {
    console.log(`[zoom-webhook] zoom_user_id=${hostId} のユーザーが見つかりません`);
    console.log(`[zoom-webhook] 登録済みzoom_user_ids: ${allIntegrations?.map(i => i.metadata?.zoom_user_id).join(', ')}`);
    return;
  }

  const integration = integrations[0];
  const isExpired = new Date(integration.expires_at) <= new Date(Date.now() + 60_000);
  const accessToken = isExpired
    ? await refreshToken(integration)
    : integration.access_token;

  // トランスクリプトファイルを取得
  const transcriptFile = object.recording_files?.find(
    f => f.file_type === 'TRANSCRIPT' && f.status === 'completed'
  );
  let logText = '';
  if (transcriptFile) {
    const vttRes = await fetch(
      `${transcriptFile.download_url}?access_token=${accessToken}`
    );
    if (vttRes.ok) logText = parseVtt(await vttRes.text());
  }

  const participants = [...new Set(
    (object.participant_video_files || []).map(p => p.user_name).filter(Boolean)
  )];

  console.log(`[zoom-webhook] transcript有無=${!!transcriptFile} log文字数=${logText.length}`);

  const saveRes = await fetch(`${supabaseUrl}/rest/v1/meetings`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      user_id: integration.user_id,
      tenant_id: integration.tenant_id,
      title: object.topic || '無題の会議',
      date: object.start_time,
      log: logText || null,
      participants,
      source: 'zoom',
      external_id: object.uuid,
      data: {
        zoom_meeting_id: object.id,
        zoom_uuid: object.uuid,
        duration: object.duration,
      },
    }),
  });
  if (!saveRes.ok) {
    const errText = await saveRes.text();
    console.error(`[zoom-webhook] meetings保存失敗 status=${saveRes.status} body=${errText}`);
  } else {
    console.log(`[zoom-webhook] 保存完了: ${object.topic} (${object.uuid})`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody = await getRawBody(req);
  let body;
  try {
    body = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: 'JSONパース失敗' });
  }

  // 疎通確認
  if (body.event === 'endpoint.url_validation') {
    const hash = crypto
      .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET)
      .update(body.payload.plainToken)
      .digest('hex');
    return res.json({ plainToken: body.payload.plainToken, encryptedToken: hash });
  }

  // 署名検証
  try {
    verifySignature(
      rawBody,
      req.headers['x-zm-request-timestamp'],
      req.headers['x-zm-signature']
    );
  } catch (err) {
    return res.status(401).json({ error: err.message });
  }

  // 先に200を返す（Zoomは5秒でタイムアウト）
  res.status(200).json({ received: true });

  if (body.event === 'recording.transcript_completed') {
    processTranscript(body.payload).catch(err =>
      console.error('transcript処理エラー:', err)
    );
  }
};
