-- Student deployments: batch-end override, disk usage, risk flags, and an
-- index for the once-per-visitor-per-day dedupe in serve-site.
ALTER TABLE "users" ADD COLUMN "deploy_after_batch_end" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "deployments" ADD COLUMN "size_bytes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "deployments" ADD COLUMN "risk_flags" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "visitor_logs_deployment_id_visitor_ip_date_idx" ON "visitor_logs"("deployment_id", "visitor_ip", "date");
