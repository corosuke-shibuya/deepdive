const { ANALYSIS_PROMPT, fmt, callAnthropic, cors, verifyAuth } = require('./_lib');

module.exports = async function(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Verify user is authenticated
    const user = await verifyAuth(req);

    const { meeting_log, context, participants, my_name } = req.body || {};

    if (!meeting_log || meeting_log.trim().length < 20) {
      return res.status(400).json({ error: '会議ログが短すぎます（最低20文字）' });
    }

    const myNameNote = my_name
      ? `\n※ ログ中の「${my_name}」がこの分析を依頼したユーザー本人です。overall_scoreおよびsubscoresは、会議全体ではなく「${my_name}」本人のコミュニケーション品質を評価してください。`
      : '\n※ ユーザー本人の呼称が未指定のため、overall_scoreは会議参加者全体のコミュニケーション品質を総合評価してください。';

    const prompt = fmt(ANALYSIS_PROMPT, {
      context: context || '特に指定なし',
      participants: participants || '特に指定なし',
      meeting_log: meeting_log.trim()
    }) + myNameNote;

    const data = await callAnthropic(prompt);
    return res.json({ success: true, data });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
