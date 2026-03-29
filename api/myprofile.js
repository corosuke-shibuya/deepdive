const { MYPROFILE_PROMPT, fmt, callAnthropic, cors, verifyAuth, AuthError } = require('./_lib');

module.exports = async function(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Verify user is authenticated
    const user = await verifyAuth(req);

    const { history } = req.body || {};

    if (!history || history.length < 2) {
      return res.status(400).json({ error: 'プロフィール生成には2回以上の分析が必要です' });
    }
    // Input size limits (prevent API cost abuse)
    if (history.length > 100) return res.status(400).json({ error: '履歴は最大100件までです' });

    // Aggregate scores
    const scores = history.map(h => h.score || 0);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const trend = scores.slice(-5).join(' → ');
    const delta = scores[0] - scores[scores.length - 1];
    const deltaStr = delta > 0 ? `+${delta}ポイント向上` : delta < 0 ? `${delta}ポイント低下` : '変化なし';

    // Subscores average
    const subKeys = ['clarity', 'empathy', 'persuasion', 'listening', 'constructiveness', 'conciseness'];
    const subNames = { clarity: '明確さ', empathy: '共感力', persuasion: '説得力', listening: '傾聴力', constructiveness: '建設性', conciseness: '簡潔さ' };
    const subAvgs = {};
    for (const k of subKeys) {
      const vals = history.filter(h => h.data?.subscores?.[k]).map(h => h.data.subscores[k]);
      subAvgs[k] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    }
    const subscoresText = subKeys.map(k => `- ${subNames[k]}: ${subAvgs[k]}点`).join('\n');

    // Frequency counts
    const gapTypes = {};
    const strengthsList = [];
    const actionTitles = {};
    for (const h of history) {
      const d = h.data || {};
      for (const g of d.gaps || []) {
        if (g.gap_type) gapTypes[g.gap_type] = (gapTypes[g.gap_type] || 0) + 1;
      }
      strengthsList.push(...(d.strengths || []));
      for (const a of d.improvement_actions || []) {
        if (a.title) actionTitles[a.title] = (actionTitles[a.title] || 0) + 1;
      }
    }

    const gapPatterns = Object.entries(gapTypes)
      .sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([t, c]) => `- ${t}（${c}回）`).join('\n') || '（データなし）';
    const strengthsText = strengthsList.slice(0, 5).map(s => `- ${s}`).join('\n') || '（データなし）';
    const actionsText = Object.entries(actionTitles)
      .sort((a, b) => b[1] - a[1]).slice(0, 4)
      .map(([t, c]) => `- ${t}（${c}回）`).join('\n') || '（データなし）';

    const prompt = fmt(MYPROFILE_PROMPT, {
      n: history.length,
      avg_score: avg,
      trend,
      score_delta: deltaStr,
      subscores_text: subscoresText,
      gap_patterns: gapPatterns,
      strengths: strengthsText,
      actions: actionsText
    });

    const data = await callAnthropic(prompt);
    return res.json({ success: true, data });

  } catch(e) {
    if (e instanceof AuthError) return res.status(401).json({ error: e.message });
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
};
