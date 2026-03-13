const { PARTICIPANT_PROMPT, fmt, callAnthropic, cors } = require('./_lib');

module.exports = async function(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { name, role, meeting_log } = req.body || {};

    if (!name) return res.status(400).json({ error: '参加者名が必要です' });
    if (!meeting_log) return res.status(400).json({ error: '会議ログが必要です' });

    const prompt = fmt(PARTICIPANT_PROMPT, {
      name: name.trim(),
      role: role || '参加者',
      meeting_log: meeting_log.trim()
    });

    const data = await callAnthropic(prompt);
    return res.json({ success: true, data });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
