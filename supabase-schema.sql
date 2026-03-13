-- ============================================================
-- Deep Dive - Supabase Schema
-- Supabase の SQL Editor で実行してください
-- ============================================================

-- 1. 会議分析履歴
create table if not exists meetings (
  id bigint primary key,                            -- Date.now() の値をそのまま使用
  user_id uuid references auth.users(id) on delete cascade not null,
  title text,
  date text,
  context text,
  participants text,
  log text,
  score integer,
  data jsonb,
  created_at timestamp with time zone default now()
);

-- 2. 参加者プロフィール
create table if not exists persons (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  role text,
  profile jsonb,
  meeting_ids jsonb default '[]'::jsonb,
  last_seen text,
  enough_data boolean default false,
  updated_at timestamp with time zone default now(),
  unique(user_id, name)
);

-- 3. マイプロフィールキャッシュ
create table if not exists myprofile_cache (
  user_id uuid references auth.users(id) on delete cascade primary key,
  data jsonb,
  updated_at timestamp with time zone default now()
);

-- ============================================================
-- Row Level Security（各ユーザーが自分のデータだけ見える）
-- ============================================================

alter table meetings enable row level security;
alter table persons enable row level security;
alter table myprofile_cache enable row level security;

-- meetings ポリシー
create policy "meetings: own data only"
  on meetings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- persons ポリシー
create policy "persons: own data only"
  on persons for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- myprofile_cache ポリシー
create policy "myprofile_cache: own data only"
  on myprofile_cache for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- インデックス（パフォーマンス向上）
-- ============================================================

create index if not exists meetings_user_id_idx on meetings(user_id, created_at desc);
create index if not exists persons_user_id_idx on persons(user_id);
