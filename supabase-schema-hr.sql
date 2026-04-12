-- ============================================================
-- Deep Dive - HR管理ダッシュボード用スキーマ拡張
-- Supabase の SQL Editor で実行してください
-- ============================================================

-- 1. テナント（企業）テーブル
create table if not exists tenants (
  id uuid default gen_random_uuid() primary key,
  name text not null,                             -- 企業・組織名
  created_at timestamptz default now()
);

-- 2. テナントユーザー（HR役割）テーブル
--    role: 'user'（一般）| 'hr_general'（HR閲覧）| 'hr_admin'（HR管理者）
create table if not exists tenant_users (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references tenants(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'user'
    check (role in ('user', 'hr_general', 'hr_admin')),
  created_at timestamptz default now(),
  unique(tenant_id, user_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table tenants enable row level security;
alter table tenant_users enable row level security;

-- tenants: 自分が所属するテナントのみ参照可能
create policy "tenants: member read"
  on tenants for select
  using (
    id in (
      select tenant_id from tenant_users where user_id = auth.uid()
    )
  );

-- tenant_users: 自分のレコードは常に参照可能
create policy "tenant_users: self read"
  on tenant_users for select
  using (user_id = auth.uid());

-- tenant_users: hr_admin は同テナントの全メンバーを参照可能
create policy "tenant_users: hr_admin read team"
  on tenant_users for select
  using (
    tenant_id in (
      select tenant_id from tenant_users
      where user_id = auth.uid() and role = 'hr_admin'
    )
  );

-- ============================================================
-- インデックス
-- ============================================================

create index if not exists tenant_users_user_id_idx on tenant_users(user_id);
create index if not exists tenant_users_tenant_id_idx on tenant_users(tenant_id);

-- ============================================================
-- meetings テーブルに tenant_id カラムを追加
-- （既存レコードは NULL → テナント未所属として扱う）
-- ============================================================

alter table meetings
  add column if not exists tenant_id uuid references tenants(id) on delete set null;

create index if not exists meetings_tenant_id_idx on meetings(tenant_id, created_at desc);

-- ============================================================
-- HR ダッシュボード用のビュー（集計ヘルパー）
-- プライバシー保護: 5名以上のテナントのみデータを返す
-- ============================================================

-- ※ このビューは Supabase RLS を使わず、APIサーバー側で
--    テナントメンバー数チェック・認可を行います。
--    ビュー自体は集計クエリのリファレンス用コメントです。

/*
  HR ダッシュボード集計クエリ例（APIサーバー側で実行）:

  -- F-01: KPIカード
  SELECT
    COUNT(DISTINCT user_id) AS active_users,
    COUNT(*) AS total_meetings,
    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT user_id), 0), 1) AS meetings_per_user
  FROM meetings
  WHERE tenant_id = $tenant_id
    AND created_at >= now() - interval '30 days';

  -- F-02: スコア週次推移（直近8週）
  SELECT
    date_trunc('week', created_at) AS week,
    ROUND(AVG(score), 1) AS avg_score,
    COUNT(*) AS count
  FROM meetings
  WHERE tenant_id = $tenant_id
    AND created_at >= now() - interval '56 days'
  GROUP BY 1 ORDER BY 1;

  -- F-03: スキル別平均スコア（当月 vs 前月）
  SELECT
    ROUND(AVG((data->'subscores'->>'clarity')::numeric), 1) AS clarity,
    ROUND(AVG((data->'subscores'->>'empathy')::numeric), 1) AS empathy,
    ROUND(AVG((data->'subscores'->>'persuasion')::numeric), 1) AS persuasion,
    ROUND(AVG((data->'subscores'->>'listening')::numeric), 1) AS listening,
    ROUND(AVG((data->'subscores'->>'constructiveness')::numeric), 1) AS constructiveness,
    ROUND(AVG((data->'subscores'->>'conciseness')::numeric), 1) AS conciseness
  FROM meetings
  WHERE tenant_id = $tenant_id
    AND created_at >= date_trunc('month', now());
*/
