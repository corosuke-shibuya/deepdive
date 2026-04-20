-- ============================================================
-- Deep Dive - Participants Schema
-- Supabase の SQL Editor で実行してください
-- ============================================================

-- 1. 関係性マスタ
--    user_id = NULL  → システム標準（全ユーザーに表示）
--    user_id = 値あり → そのユーザー専用のカスタム項目
create table if not exists relationship_types (
  id           uuid        default gen_random_uuid() primary key,
  code         varchar     not null unique,
  label_ja     varchar     not null,
  sort_order   integer     not null default 0,
  is_active    boolean     not null default true,
  user_id      uuid        references auth.users(id) on delete cascade,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- 2. 関係者
create table if not exists participants (
  id                   uuid        default gen_random_uuid() primary key,
  user_id              uuid        references auth.users(id) on delete cascade not null,
  log_name             varchar     not null,
  display_name         varchar,
  relationship_type_id uuid        references relationship_types(id) not null,
  context_note         text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  unique(user_id, log_name)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table relationship_types enable row level security;
alter table participants        enable row level security;

-- relationship_types: 全ユーザーがシステム標準（user_id IS NULL）を参照可能
--                     自分のカスタム項目（user_id = auth.uid()）も参照可能
create policy "relationship_types: read system and own"
  on relationship_types for select
  using (user_id is null or auth.uid() = user_id);

create policy "relationship_types: insert own"
  on relationship_types for insert
  with check (auth.uid() = user_id);

create policy "relationship_types: update own"
  on relationship_types for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "relationship_types: delete own"
  on relationship_types for delete
  using (auth.uid() = user_id);

-- participants: 自分のデータのみ
create policy "participants: own data only"
  on participants for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- インデックス
-- ============================================================

create index if not exists relationship_types_sort_idx
  on relationship_types(sort_order) where is_active = true;

create index if not exists participants_user_id_idx
  on participants(user_id);

create index if not exists participants_relationship_type_idx
  on participants(relationship_type_id);

-- ============================================================
-- シードデータ（関係性マスタ 4件）
-- ============================================================
-- user_id = NULL でシステム標準として投入
-- on conflict で冪等実行可能

insert into relationship_types (code, label_ja, sort_order, user_id)
values
  ('boss',        '上司', 1, null),
  ('subordinate', '部下', 2, null),
  ('peer',        '同僚', 3, null),
  ('external',    '社外', 4, null)
on conflict (code) do nothing;
