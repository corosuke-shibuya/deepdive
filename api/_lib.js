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

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`外部APIの応答がタイムアウトしました (${timeoutMs}ms)`);
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Call Anthropic API using server-side key
async function callAnthropic(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('サーバー設定エラー: ANTHROPIC_API_KEY が未設定です');

  const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
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
  }, 45000);

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

// Auth error class to distinguish auth failures from server errors
class AuthError extends Error {
  constructor(message) {
    super(message);
    this.isAuthError = true;
  }
}

// Auth verification helper - delegates token validation to Supabase Auth server.
// This works with both legacy shared-secret JWTs and newer signing-key setups.
async function verifyAuth(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new AuthError('認証が必要です');
  }

  const token = authHeader.slice(7);
  if (!token) throw new AuthError('トークンが空です');

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEYS;
  if (!supabaseUrl) throw new Error('サーバー設定エラー: SUPABASE_URL が未設定です');
  if (!anonKey) throw new Error('サーバー設定エラー: SUPABASE_ANON_KEYS が未設定です');

  try {
    const response = await fetchWithTimeout(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`
      }
    }, 10000);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AuthError('認証エラー: トークンが無効です');
      }
      const body = await response.json().catch(() => ({}));
      const msg = body?.msg || body?.error_description || body?.error || response.statusText;
      throw new Error(`Supabase Auth 検証エラー (${response.status}): ${msg}`);
    }

    const user = await response.json();
    if (!user?.id) throw new AuthError('認証エラー: ユーザー情報を取得できませんでした');

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      user
    };
  } catch(e) {
    // Re-throw AuthError as-is; wrap others
    if (e.isAuthError) throw e;
    console.error('verifyAuth error:', e);
    throw new AuthError(`認証エラー: ${e.message}`);
  }
}

// ============================================================
// Rate Limiting (in-memory, fixed window)
//
// ⚠️ サーバーレス環境での制約:
//   Vercel は各 Function インスタンスを独立したプロセスで実行するため、
//   このストアはインスタンス間で共有されません。
//   ウォームインスタンスが複数起動している場合、制限は「インスタンスごと」に
//   適用されます（グローバルなユーザー単位ではありません）。
//   将来 Redis / Upstash に移行する場合は checkRateLimit() だけ差し替えてください。
// ============================================================

/** @type {Map<string, { count: number, resetAt: number }>} */
const _rateLimitStore = new Map();

// Periodically purge expired entries to prevent unbounded Map growth.
// Runs lazily: triggered every 500 inserts.
let _rlInsertCount = 0;
function _maybePurgeExpired() {
  if (++_rlInsertCount < 500) return;
  _rlInsertCount = 0;
  const now = Date.now();
  for (const [key, entry] of _rateLimitStore) {
    if (now >= entry.resetAt) _rateLimitStore.delete(key);
  }
}

class RateLimitError extends Error {
  constructor(message, retryAfter) {
    super(message);
    this.isRateLimitError = true;
    this.retryAfter = retryAfter; // seconds
  }
}

/**
 * Fixed-window rate limiter.
 * Throws RateLimitError when the limit is exceeded.
 *
 * @param {string} userId   - user.sub from verified JWT
 * @param {string} endpoint - short name, e.g. 'analyze'
 * @param {number} limit    - max requests allowed within the window
 * @param {number} windowMs - window length in milliseconds
 */
function checkRateLimit(userId, endpoint, limit, windowMs) {
  const key = `${userId}:${endpoint}`;
  const now = Date.now();
  const entry = _rateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    // Start a new window
    _rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    _maybePurgeExpired();
    return;
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    throw new RateLimitError(
      `リクエストが多すぎます。${retryAfter}秒後に再試行してください。`,
      retryAfter
    );
  }

  entry.count += 1;
}

module.exports = { ANALYSIS_PROMPT, PARTICIPANT_PROMPT, MEETING_PREP_PROMPT, MYPROFILE_PROMPT, fmt, extractJson, callAnthropic, cors, verifyAuth, AuthError, checkRateLimit, RateLimitError };
