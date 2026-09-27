-- A hidden, non-deletable per-course admin row is auto-created the first
-- time the platform's super_admin logs into that course's own login form
-- with their real credentials. This flag marks such rows so every listing
-- (Access Management, Admin Users, SaaS admin lists) can exclude them.
ALTER TABLE "users"
    ADD COLUMN "is_super_admin_shadow" BOOLEAN NOT NULL DEFAULT false;
