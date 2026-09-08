-- AlterTable
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'RADAR';
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "external_bid_id" TEXT;

CREATE INDEX IF NOT EXISTS "applications_workspace_id_source_idx" ON "applications"("workspace_id", "source");
CREATE INDEX IF NOT EXISTS "applications_external_bid_id_idx" ON "applications"("external_bid_id");
