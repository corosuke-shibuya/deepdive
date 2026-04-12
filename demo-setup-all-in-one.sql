-- ============================================================
-- Deep Dive HR ダッシュボード セットアップ（全部まとめ版）
-- Supabase SQL Editor にこのファイルを丸ごとペーストして実行
-- ============================================================

-- ① テーブル作成
CREATE TABLE IF NOT EXISTS tenants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'hr_general', 'hr_admin')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL;

-- ② RLS 有効化
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- ③ RLS ポリシー（重複エラー防止のためDROP → CREATE）
DROP POLICY IF EXISTS "tenants: member read" ON tenants;
CREATE POLICY "tenants: member read" ON tenants FOR SELECT
  USING (id IN (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "tenant_users: self read" ON tenant_users;
CREATE POLICY "tenant_users: self read" ON tenant_users FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "tenant_users: hr_admin read team" ON tenant_users;
CREATE POLICY "tenant_users: hr_admin read team" ON tenant_users FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users
    WHERE user_id = auth.uid() AND role = 'hr_admin'
  ));

-- ④ インデックス
CREATE INDEX IF NOT EXISTS tenant_users_user_id_idx ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS tenant_users_tenant_id_idx ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS meetings_tenant_id_idx ON meetings(tenant_id, created_at DESC);

-- ⑤ デモテナント登録
INSERT INTO tenants (id, name) VALUES
  ('143f1212-dfd6-4c2d-9ec1-4780d7f776b9', '株式会社デモA（マネージャー研修）'),
  ('e2f7489a-34ad-428b-85fb-86926c199c4e', '株式会社デモB（小規模テスト）')
ON CONFLICT (id) DO NOTHING;

-- ⑥ デモユーザー登録
INSERT INTO tenant_users (tenant_id, user_id, role) VALUES
  -- テナントA（4名・ダッシュボード表示）
  ('143f1212-dfd6-4c2d-9ec1-4780d7f776b9', 'b6c6837f-1cee-4287-9373-de3eb3bb5f5e', 'hr_admin'),
  ('143f1212-dfd6-4c2d-9ec1-4780d7f776b9', '7992b464-d132-4bb6-9a58-d1be9aa29eea', 'hr_general'),
  ('143f1212-dfd6-4c2d-9ec1-4780d7f776b9', '928e2b03-bbd9-4c08-98af-01a808116ab4', 'user'),
  ('143f1212-dfd6-4c2d-9ec1-4780d7f776b9', 'dc67007f-16c1-4e50-8f35-a1580cefcf1b', 'user'),
  -- テナントB（2名・プライバシーブロック表示）
  ('e2f7489a-34ad-428b-85fb-86926c199c4e', 'b6c6837f-1cee-4287-9373-de3eb3bb5f5e', 'hr_admin'),
  ('e2f7489a-34ad-428b-85fb-86926c199c4e', '928e2b03-bbd9-4c08-98af-01a808116ab4', 'user')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ⑦ 既存の会議データをテナントAに紐づけ
UPDATE meetings
  SET tenant_id = '143f1212-dfd6-4c2d-9ec1-4780d7f776b9'
WHERE user_id IN (
  'b6c6837f-1cee-4287-9373-de3eb3bb5f5e',
  '7992b464-d132-4bb6-9a58-d1be9aa29eea',
  '928e2b03-bbd9-4c08-98af-01a808116ab4',
  'dc67007f-16c1-4e50-8f35-a1580cefcf1b'
);

-- ⑧ 確認（実行後にこの結果が表示されればOK）
SELECT t.name AS テナント, tu.user_id, tu.role
FROM tenant_users tu
JOIN tenants t ON t.id = tu.tenant_id
ORDER BY t.name, tu.role;
