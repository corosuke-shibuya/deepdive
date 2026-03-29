const { ANALYSIS_PROMPT, fmt, callAnthropic, cors, verifyAuth, AuthError, checkRateLimit, RateLimitError } = require('./_lib');

module.exports = async function(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // Verify user is authenticated
    const user = await verifyAuth(req);
    // Rate limit: 5 requests per minute per user
    checkRateLimit(user.sub, 'analyze', 5, 60 * 1000);

    const { meeting_log, context, participants, my_name } = req.body || {};

    // Input validation with size limits (prevent API cost abuse)
    if (!meeting_log || meeting_log.trim().length < 20) {
      return res.status(400).json({ error: '会議ログが短すぎます（最低20文字）' });
    }
    if (meeting_log.length > 20000) return res.status(400).json({ error: '会議ログが長すぎます（最大20000文字）' });
    if (context && context.length > 500) return res.status(400).json({ error: '状況・背景は500文字以内で入力してください' });
    if (participants && participants.length > 300) return res.status(400).json({ error: '参加者は300文字以内で入力してください' });
    if (my_name && my_name.length > 50) return res.status(400).json({ error: '自分の呼称は50文字以内で入力してください' });

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
    if (e instanceof RateLimitError) {
      res.setHeader('Retry-After', String(e.retryAfter));
      return res.status(429).json({ error: e.message });
    }
    if (e instanceof AuthError) return res.status(401).json({ error: e.message });
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
};
