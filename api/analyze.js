const { ANALYSIS_PROMPT, fmt, callAnthropic, cors } = require('./_lib');

module.exports = async function(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { meeting_log, context, participants } = req.body || {};

    if (!meeting_log || meeting_log.trim().length < 20) {
      return res.status(400).json({ error: '会議ログが短すぎます（最低20文字）' });
    }

    const prompt = fmt(ANALYSIS_PROMPT, {
      context: context || '特に指定なし',
      participants: participants || '特に指定なし',
      meeting_log: meeting_log.trim()
    });

    const data = await callAnthropic(prompt);
    return res.json({ success: true, data });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
