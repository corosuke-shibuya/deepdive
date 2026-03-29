// ============================================================
// Deep Dive - Shared utilities for Vercel Functions
// ============================================================

const ANALYSIS_PROMPT = `ビジネスコミュニケーション分析の専門家として、以下の会議ログを分析してください。

背景: {context}
参加者: {participants}

会議ログ:
{meeting_log}

必ずJSONのみで回答（前後に説明文不要）:
{"overall_score":75,"subscores":{"clarity":80,"empathy":60,"persuasion":75,"listening":55,"constructiveness":70,"conciseness":85},"gaps":[{"situation":"場面の引用","speaker_intent":"話し手の意図","likely_reception":"相手の受け取り方","gap_type":"ズレの種類","severity":"high"}],"strengths":["良い点"],"improvement_actions":[{"priority":1,"title":"タイトル","description":"改善方法","example_phrase":"言い換え例","impact":"期待効果"}],"next_meeting_checklist":["チェック項目"],"summary":"総合評価（2文以内）","detected_persons":[{"name":"登場人物名","enough_data":true,"role":"役割や立場"}]}

ルール: gaps最大2件、actions最大3件、checklist最大4件、detected_persons最大5件（ログに登場した人物のみ、enough_dataは発言が3回以上ならtrue）、各テキストは60字以内、日本語で回答`;

const PARTICIPANT_PROMPT = `ビジネスコミュニケーションの専門家として、以下の会議ログから「{name}」のコミュニケーション特性を分析してください。

{name}の役割: {role}
会議ログ:
{meeting_log}

【コミュニケーションタイプ一覧】
必ず以下の6タイプから、この人物に最も合致する1つを選んでください。
1. 論理構築型 / 🧠 … データ・根拠を重視し、論理的に話を組み立てる
2. 関係重視型 / 🤝 … 人間関係・共感を大切にし、場の空気を読む
3. 推進決断型 / ⚡ … スピードと結果を重視し、率直に意見を言う
4. 調和配慮型 / 🌿 … 対立を避け、全員の意見をまとめようとする
5. 慎重分析型 / 🔍 … リスクを見極め、慎重に判断する
6. 表現共有型 / 🌟 … 感情・ビジョンを言語化し、周囲を巻き込む

必ずJSONのみで回答（前後に説明文不要）:
{"communication_type":"上記6タイプから1つ選んだタイプ名（例：論理構築型）","type_icon":"そのタイプの絵文字","communication_style":"コミュニケーションスタイルの特徴","decision_pattern":"意思決定の傾向","emotional_triggers":["反応しやすいポイント"],"effective_approach":"効果的なアプローチ方法","phrases_that_work":["刺さる言葉・フレーズ"],"phrases_to_avoid":["避けるべき言葉・アプローチ"],"summary":"この人物への総合的な攻略法（2文以内）"}

ルール: 各リスト最大3件、各テキスト80字以内、日本語で回答`;

const MEETING_PREP_PROMPT = `ビジネスコミュニケーションの専門家として、以下の会議の事前戦略を立案してください。

会議の目的: {goal}
議題・話したいこと: {agenda}
想定される懸念・反論: {concerns}
参加者プロフィール:
{profiles}

必ずJSONのみで回答（前後に説明文不要）:
{"opening_strategy":"会議の入り方・アイスブレイク","key_messages":[{"point":"伝えたいポイント","how_to_present":"伝え方","expected_reaction":"想定される反応"}],"closing_strategy":"会議の締め方・次のアクション設定","risk_points":["注意すべきリスク・懸念点と対処法"],"checklist":["会議前に準備すること"],"summary":"この会議の攻略ポイント（2文以内）"}

ルール: key_messages最大3件、risk_points最大4件（ユーザーが入力した懸念点を優先的に含める）、checklist最大4件、各テキスト80字以内、日本語で回答`;

const MYPROFILE_PROMPT = `ビジネスコミュニケーションの専門家として、以下の分析実績データをもとに、このユーザーの「コミュニケーション総合プロフィール」を作成してください。

【分析実績サマリー】
分析回数: {n}回
平均スコア: {avg_score}点
スコア推移: {trend}
スコア変化: {score_delta}

【スキル別平均スコア】
{subscores_text}

【頻出する課題パターン（上位）】
{gap_patterns}

【繰り返し現れる強み】
{strengths}

【頻出の改善アクション】
{actions}

【コミュニケーションタイプ一覧】
必ず以下の6タイプから、データに最も合致する1つを選んでください。自由に作らないこと。
1. 論理構築型 / 🧠 … データ・根拠を重視し、論理的に話を組み立てる
2. 関係重視型 / 🤝 … 人間関係・共感を大切にし、場の空気を読む
3. 推進決断型 / ⚡ … スピードと結果を重視し、率直に意見を言う
4. 調和配慮型 / 🌿 … 対立を避け、全員の意見をまとめようとする
5. 慎重分析型 / 🔍 … リスクを見極め、慎重に判断する
6. 表現共有型 / 🌟 … 感情・ビジョンを言語化し、周囲を巻き込む

必ずJSONのみで回答（前後に説明文不要）:
{"personality_type":"上記6タイプから1つ選んだタイプ名（例：論理構築型）","type_icon":"そのタイプの絵文字（上記リストの絵文字を使うこと）","type_description":"そのタイプの特徴（3文以内）","core_strengths":[{"strength":"強みの名前","description":"具体的な説明","evidence":"分析データからの根拠"}],"blind_spots":[{"pattern":"陥りがちなパターン名","trigger":"こういう状況で出やすい","impact":"相手への影響","hint":"気づき方のヒント"}],"growth_areas":[{"area":"成長領域","current_score":60,"tip":"具体的な改善アクション"}],"communication_mantra":"あなたの強みを活かすための一言（20字以内）","next_focus":"今すぐ取り組む最優先アクション（1つ）","overall_assessment":"総合的な評価コメント（3文以内）"}

ルール: core_strengths最大3件、blind_spots最大3件、growth_areas最大3件、各テキスト80字以内、日本語で回答`;

// Simple template formatter: replaces {key} with vars[key]
function fmt(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] !== undefined ? vars[k] : '');
}

// Extract JSON from Claude response (handles truncation / code blocks)
function extractJson(text) {
  text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(text); } catch(e) {}

  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch(e) {}
  }

  let chunk = match ? match[0] : text;
  const opens = (chunk.match(/\{/g) || []).length - (chunk.match(/\}/g) || []).length;
  const arrOpens = (chunk.match(/\[/g) || []).length - (chunk.match(/\]/g) || []).length;
  chunk = chunk.replace(/,\s*$/, '').trimEnd();
  chunk = chunk.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, '');
  chunk += ']'.repeat(Math.max(0, arrOpens)) + '}'.repeat(Math.max(0, opens));
  try { return JSON.parse(chunk); } catch(e) {
    throw new Error(`JSON解析エラー: ${e.message} | 先頭200字: ${text.slice(0, 200)}`);
  }
}

// Call Anthropic API using server-side key
async function callAnthropic(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('サーバー設定エラー: ANTHROPIC_API_KEY が未設定です');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body?.error?.message || response.statusText;
    if (response.status === 401) throw new Error('サーバーのAPIキーが無効です');
    if (response.status === 429) throw new Error('API利用制限に達しました。しばらく経ってから再試行してください。');
    throw new Error(`APIエラー (${response.status}): ${msg}`);
  }

  const result = await response.json();
  const text = result.content[0].text;
  return extractJson(text);
}

// CORS headers helper - restrict to own Vercel domain
function cors(res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://deepdive-azure.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

// JWT verification using Node.js built-in crypto (no external dependencies)
// Verifies HS256 signature, expiration, and payload structure
function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('無効なトークン形式です');

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify HMAC-SHA256 signature using native crypto
  const crypto = require('crypto');
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signingInput)
    .digest('base64url');

  // Constant-time comparison to prevent timing attacks
  const sigBuf = Buffer.from(signatureB64);
  const expBuf = Buffer.from(expectedSig);
  const signaturesMatch = sigBuf.length === expBuf.length &&
    crypto.timingSafeEqual(sigBuf, expBuf);
  if (!signaturesMatch) throw new Error('トークンの署名が無効です');

  // Decode and validate payload
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('トークンの有効期限が切れています');
  if (payload.nbf && payload.nbf > now) throw new Error('トークンがまだ有効ではありません');

  return payload;
}

// Auth error class to distinguish auth failures from server errors
class AuthError extends Error {
  constructor(message) {
    super(message);
    this.isAuthError = true;
  }
}

// JWT verification helper - validates Supabase JWT token from Authorization header
async function verifyAuth(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new AuthError('認証が必要です');
  }

  const token = authHeader.slice(7);
  if (!token) throw new AuthError('トークンが空です');

  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) throw new Error('サーバー設定エラー: SUPABASE_JWT_SECRET が未設定です');

  try {
    const payload = verifyJWT(token, jwtSecret);
    if (!payload.sub) throw new AuthError('トークンにユーザーIDがありません');
    return payload;
  } catch(e) {
    // Re-throw AuthError as-is; wrap others
    if (e.isAuthError) throw e;
    throw new AuthError(`認証エラー: ${e.message}`);
  }
}

module.exports = { ANALYSIS_PROMPT, PARTICIPANT_PROMPT, MEETING_PREP_PROMPT, MYPROFILE_PROMPT, fmt, extractJson, callAnthropic, cors, verifyAuth, AuthError };
