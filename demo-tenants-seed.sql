-- ============================================================
-- Deep Dive デモ用テナントシード（4名対応版）
-- 実行順序:
--   1. まず supabase-schema-hr.sql を実行（テーブル作成）
--   2. このファイルを実行（デモデータ登録）
-- ============================================================

-- ===== テナント作成 =====
INSERT INTO tenants (id, name) VALUES
  ('143f1212-dfd6-4c2d-9ec1-4780d7f776b9', '株式会社デモA（マネージャー研修）'),
  ('e2f7489a-34ad-428b-85fb-86926c199c4e', '株式会社デモB（小規模テスト）')
ON CONFLICT (id) DO NOTHING;

-- ===== テナントAにユーザーを登録（4名 → デモ閾値3名をクリア） =====
INSERT INTO tenant_users (tenant_id, user_id, role) VALUES
  -- HR管理者: ダッシュボード全機能を確認できるアカウント
  ('143f1212-dfd6-4c2d-9ec1-4780d7f776b9', 'b6c6837f-1cee-4287-9373-de3eb3bb5f5e', 'hr_admin'),
  -- HR閲覧: ユーザー管理なしの閲覧専用
  ('143f1212-dfd6-4c2d-9ec1-4780d7f776b9', '7992b464-d132-4bb6-9a58-d1be9aa29eea', 'hr_general'),
  -- 一般メンバー
  ('143f1212-dfd6-4c2d-9ec1-4780d7f776b9', '928e2b03-bbd9-4c08-98af-01a808116ab4', 'user'),
  ('143f1212-dfd6-4c2d-9ec1-4780d7f776b9', 'dc67007f-16c1-4e50-8f35-a1580cefcf1b', 'user')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ===== テナントBはプライバシーブロックのデモ用（テナントAと同じhrアカウントを使い回し） =====
INSERT INTO tenant_users (tenant_id, user_id, role) VALUES
  ('e2f7489a-34ad-428b-85fb-86926c199c4e', 'b6c6837f-1cee-4287-9373-de3eb3bb5f5e', 'hr_admin'),
  ('e2f7489a-34ad-428b-85fb-86926c199c4e', '928e2b03-bbd9-4c08-98af-01a808116ab4', 'user')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- ===== 既存の会議データをテナントAに紐づけ =====
UPDATE meetings
  SET tenant_id = '143f1212-dfd6-4c2d-9ec1-4780d7f776b9'
WHERE user_id IN (
  'b6c6837f-1cee-4287-9373-de3eb3bb5f5e',
  '7992b464-d132-4bb6-9a58-d1be9aa29eea',
  '928e2b03-bbd9-4c08-98af-01a808116ab4',
  'dc67007f-16c1-4e50-8f35-a1580cefcf1b'
);

-- ===== 確認クエリ =====
SELECT t.name AS テナント, tu.user_id, tu.role
FROM tenant_users tu
JOIN tenants t ON t.id = tu.tenant_id
ORDER BY t.name, tu.role;
