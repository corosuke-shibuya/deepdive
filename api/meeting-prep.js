const { MEETING_PREP_PROMPT, fmt, callAnthropic, cors, verifyAuth, AuthError } = require('./_lib');

module.exports = async function(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Verify user is authenticated
    const user = await verifyAuth(req);

    const { goal, agenda, concerns, profiles } = req.body || {};

    if (!goal) return res.status(400).json({ error: '会議の目的を入力してください' });

    // Input size limits (prevent API cost abuse)
    if (goal.length > 500) return res.status(400).json({ error: '会議の目的は500文字以内で入力してください' });
    if (agenda && agenda.length > 1000) return res.status(400).json({ error: '議題は1000文字以内で入力してください' });
    if (concerns && concerns.length > 1000) return res.status(400).json({ error: '懸念事項は1000文字以内で入力してください' });
    if (profiles && profiles.length > 20) return res.status(400).json({ error: '参加者プロフィールは最大20件までです' });

    const profilesText = (profiles || []).length
      ? profiles.map(p =>
          `【${p.name}】${p.role || ''} - スタイル: ${p.communication_style || '不明'} / アプローチ: ${p.effective_approach || ''}`
        ).join('\n')
      : '（プロフィールなし）';

    const prompt = fmt(MEETING_PREP_PROMPT, {
      goal: goal.trim(),
      agenda: agenda?.trim() || '未定',
      concerns: concerns?.trim() || '（特に指定なし）',
      profiles: profilesText
    });

    const data = await callAnthropic(prompt);
    return res.json({ success: true, data });

  } catch(e) {
    if (e instanceof AuthError) return res.status(401).json({ error: e.message });
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
};
