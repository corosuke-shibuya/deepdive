const { MEETING_PREP_PROMPT, fmt, callAnthropic, cors, verifyAuth } = require('./_lib');

module.exports = async function(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Verify user is authenticated
    const user = await verifyAuth(req);

    const { goal, agenda, concerns, profiles } = req.body || {};

    if (!goal) return res.status(400).json({ error: '会議の目的を入力してください' });

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
    return res.status(500).json({ error: e.message });
  }
};
