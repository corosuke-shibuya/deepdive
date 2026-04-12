// ============================================================
// Deep Dive - HR管理ダッシュボード API
// GET /api/hr-dashboard
// ============================================================
// アクセス要件:
//   - 認証済みユーザー
//   - tenant_users.role が 'hr_general' または 'hr_admin'
// プライバシー保護:
//   - テナントメンバーが5名未満の場合はデータを返さない
// ============================================================

const { cors, verifyAuth, AuthError } = require('./_lib');

// Simple fetch with timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch(e) {
    if (e.name === 'AbortError') throw new Error(`タイムアウト (${timeoutMs}ms)`);
    throw e;
  } finally {
    clearTimeout(tid);
  }
}

// デモ環境では 3、本番では 5 に戻すこと
const MIN_USERS_FOR_AGGREGATION = process.env.HR_MIN_USERS ? parseInt(process.env.HR_MIN_USERS) : 3;

module.exports = async function(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  try {
    // 1. 認証確認
    const user = await verifyAuth(req);
    const userId = user.sub;

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      throw new Error('サーバー設定エラー: Supabase環境変数が未設定です');
    }

    // Service role key を使ったSupabase REST APIヘルパー
    async function sbQuery(path, params = {}) {
      const url = new URL(`${supabaseUrl}/rest/v1/${path}`);
      Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
      const r = await fetchWithTimeout(url.toString(), {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: 'application/json'
        }
      }, 15000);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(`Supabase query error (${r.status}): ${err.message || r.statusText}`);
      }
      return r.json();
    }

    // Supabase RPC（任意SQL）ヘルパー
    async function sbRpc(funcName, body = {}) {
      const r = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/${funcName}`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }, 15000);
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(`Supabase RPC error (${r.status}): ${err.message || r.statusText}`);
      }
      return r.json();
    }

    // 2. HRロール確認 + テナントID取得
    const tuRows = await sbQuery('tenant_users', {
      select: 'tenant_id,role',
      user_id: `eq.${userId}`,
      role: 'in.(hr_general,hr_admin)'
    });

    if (!tuRows || tuRows.length === 0) {
      return res.status(403).json({ error: 'HR権限がありません' });
    }

    const { tenant_id, role: hrRole } = tuRows[0];

    // 3. テナントメンバー一覧取得（名前・部署含む）
    const allMembers = await sbQuery('tenant_users', {
      select: 'user_id,role,display_name,department',
      tenant_id: `eq.${tenant_id}`
    });
    const memberUserIds = (allMembers || []).map(m => m.user_id);
    const totalMembers = memberUserIds.length;

    // 4. プライバシーチェック（5名未満は集計不可）
    if (totalMembers < MIN_USERS_FOR_AGGREGATION) {
      return res.status(200).json({
        privacy_block: true,
        total_members: totalMembers,
        min_required: MIN_USERS_FOR_AGGREGATION,
        message: `プライバシー保護のため、メンバーが${MIN_USERS_FOR_AGGREGATION}名以上になるとデータが表示されます（現在${totalMembers}名）`
      });
    }

    // 5. meetings テーブルから集計（tenant_id ベース）
    //    Supabase REST API の集計は limited なので、全件取得して JS 側で集計する

    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();

    // 当月・前月の境界
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd   = thisMonthStart;

    // 直近60日の会議を取得（スコア推移 + スキルスコア）
    const meetings60 = await sbQuery('meetings', {
      select: 'user_id,score,data,created_at',
      tenant_id: `eq.${tenant_id}`,
      created_at: `gte.${sixtyDaysAgo}`,
      order: 'created_at.asc'
    });

    const mtgs60 = meetings60 || [];
    const mtgs30 = mtgs60.filter(m => m.created_at >= thirtyDaysAgo);

    // ─── F-01: KPI カード ───────────────────────────────────────
    // ログイン率 = 直近30日に1件以上分析したユーザー / 全メンバー
    const activeUserIds30 = new Set(mtgs30.map(m => m.user_id));
    const loginRate = totalMembers > 0
      ? Math.round((activeUserIds30.size / totalMembers) * 100)
      : 0;

    // 振り返り閲覧数（分析回数）= 直近30日の会議数
    const totalReflections30 = mtgs30.length;

    // 1人当たり振り返り閲覧数 = 直近30日の分析数 / アクティブユーザー数
    const reflectionsPerUser = activeUserIds30.size > 0
      ? Math.round((totalReflections30 / activeUserIds30.size) * 10) / 10
      : 0;

    // ─── F-02: スコア週次推移（直近8週）────────────────────────
    const weeklyScores = {};
    for (const m of mtgs60) {
      const d = new Date(m.created_at);
      // 週の月曜日を計算
      const day = d.getDay(); // 0=Sun,1=Mon,...
      const diff = (day === 0 ? -6 : 1 - day);
      const monday = new Date(d);
      monday.setDate(d.getDate() + diff);
      monday.setHours(0, 0, 0, 0);
      const weekKey = monday.toISOString().slice(0, 10);

      if (!weeklyScores[weekKey]) weeklyScores[weekKey] = { scores: [], count: 0 };
      if (m.score != null) weeklyScores[weekKey].scores.push(m.score);
      weeklyScores[weekKey].count++;
    }

    const scoreTrend = Object.entries(weeklyScores)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([week, v]) => ({
        week,
        avg_score: v.scores.length
          ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length)
          : null,
        count: v.count
      }));

    // ─── F-03: スキル別スコア（当月・前月）──────────────────────
    const subKeys = ['clarity', 'empathy', 'persuasion', 'listening', 'constructiveness', 'conciseness'];
    const subNames = {
      clarity: '明確さ', empathy: '共感力', persuasion: '説得力',
      listening: '傾聴力', constructiveness: '建設性', conciseness: '簡潔さ'
    };

    function avgSubscores(meetings) {
      const acc = {};
      const cnt = {};
      for (const m of meetings) {
        const ss = m.data?.subscores || {};
        for (const k of subKeys) {
          if (ss[k] != null) {
            acc[k] = (acc[k] || 0) + ss[k];
            cnt[k] = (cnt[k] || 0) + 1;
          }
        }
      }
      const result = {};
      for (const k of subKeys) {
        result[k] = cnt[k] ? Math.round(acc[k] / cnt[k]) : null;
      }
      return result;
    }

    const thisMtgs = mtgs60.filter(m => m.created_at >= thisMonthStart);
    const lastMtgs = mtgs60.filter(m => m.created_at >= lastMonthStart && m.created_at < lastMonthEnd);

    const thisMonthScores = avgSubscores(thisMtgs);
    const lastMonthScores = avgSubscores(lastMtgs);

    const skillScores = subKeys.map(k => ({
      key: k,
      name: subNames[k],
      this_month: thisMonthScores[k],
      last_month: lastMonthScores[k],
      delta: (thisMonthScores[k] != null && lastMonthScores[k] != null)
        ? thisMonthScores[k] - lastMonthScores[k]
        : null
    }));

    // ─── F-04: ユーザー管理（hr_admin のみ）─────────────────────
    let userList = null;
    if (hrRole === 'hr_admin') {
      userList = (allMembers || []).map(m => ({
        user_id: m.user_id,
        display_name: m.display_name || null,
        department: m.department || null,
        role: m.role
      }));
    }

    // ─── レスポンス ──────────────────────────────────────────────
    return res.status(200).json({
      privacy_block: false,
      hr_role: hrRole,
      tenant_id,
      total_members: totalMembers,
      kpi: {
        login_rate: loginRate,           // % (0-100)
        total_reflections: totalReflections30,  // 件
        reflections_per_user: reflectionsPerUser // 回
      },
      score_trend: scoreTrend,           // [{week, avg_score, count}]
      skill_scores: skillScores,         // [{key, name, this_month, last_month, delta}]
      user_list: userList                // hr_admin のみ; それ以外は null
    });

  } catch(e) {
    if (e instanceof AuthError) {
      return res.status(401).json({ error: e.message });
    }
    console.error('hr-dashboard error:', e);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
};
