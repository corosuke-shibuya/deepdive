-- ============================================================
-- データ削除申請テーブル
-- Supabase SQL Editor で実行してください
-- ============================================================

CREATE TABLE IF NOT EXISTS deletion_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  reason text,                                      -- 削除理由（任意）
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id)        -- 承認・却下したhr_adminのuser_id
);

ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

-- 自分の申請は参照・作成可能
CREATE POLICY "deletion_requests: self read"
  ON deletion_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "deletion_requests: self insert"
  ON deletion_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- hr_adminは同テナントの申請を参照・更新可能
CREATE POLICY "deletion_requests: hr_admin read"
  ON deletion_requests FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role = 'hr_admin'
    )
  );

CREATE POLICY "deletion_requests: hr_admin update"
  ON deletion_requests FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role = 'hr_admin'
    )
  );

CREATE INDEX IF NOT EXISTS deletion_requests_tenant_idx ON deletion_requests(tenant_id, status);
CREATE INDEX IF NOT EXISTS deletion_requests_user_idx ON deletion_requests(user_id);
