-- Run this in Neon if you already ran db/schema.sql before the auth/RBAC work.

BEGIN;

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_set_at timestamptz;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS invited_by_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

CREATE INDEX IF NOT EXISTS app_users_disabled_at_idx ON app_users(disabled_at);
CREATE INDEX IF NOT EXISTS organization_members_org_role_idx ON organization_members(organization_id, role);

COMMIT;
