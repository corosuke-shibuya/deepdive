const { PARTICIPANT_PROMPT, fmt, callAnthropic, cors, verifyAuth, AuthError } = require('./_lib');

module.exports = async function(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Verify user is authenticated
    const user = await verifyAuth(req);

    const { name, role, meeting_log } = req.body || {};

    if (!name) return res.status(400).json({ error: '参加者名が必要です' });
    if (!meeting_log) return res.status(400).json({ error: '会議ログが必要です' });

    // Input size limits (prevent API cost abuse)
    if (name.length > 100) return res.status(400).json({ error: '参加者名は100文字以内で入力してください' });
    if (role && role.length > 200) return res.status(400).json({ error: '役割は200文字以内で入力してください' });
    if (meeting_log.length > 20000) return res.status(400).json({ error: '会議ログが長すぎます（最大20000文字）' });

    const prompt = fmt(PARTICIPANT_PROMPT, {
      name: name.trim(),
      role: role || '参加者',
      meeting_log: meeting_log.trim()
    });

    const data = await callAnthropic(prompt);
    return res.json({ success: true, data });

  } catch(e) {
    if (e instanceof AuthError) return res.status(401).json({ error: e.message });
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
};
