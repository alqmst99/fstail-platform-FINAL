-- CreateEnum
CREATE TYPE "FlBidOutcome" AS ENUM ('WON', 'LOST', 'PENDING', 'RETRACTED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "freelancer_bid_snapshots" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "external_bid_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "project_title" TEXT NOT NULL,
    "seo_url" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "period" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "description" TEXT,
    "award_status" TEXT,
    "outcome" "FlBidOutcome" NOT NULL DEFAULT 'UNKNOWN',
    "client_viewed" BOOLEAN NOT NULL DEFAULT false,
    "profile_viewed" BOOLEAN NOT NULL DEFAULT false,
    "winner_amount" DOUBLE PRECISION,
    "bid_count" INTEGER,
    "avg_bid" DOUBLE PRECISION,
    "project_status" TEXT,
    "submitted_at" TIMESTAMP(3),
    "awarded_at" TIMESTAMP(3),
    "meta" JSONB NOT NULL DEFAULT '{}',
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freelancer_bid_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "freelancer_bid_snapshots_workspace_id_external_bid_id_key" ON "freelancer_bid_snapshots"("workspace_id", "external_bid_id");

-- CreateIndex
CREATE INDEX "freelancer_bid_snapshots_workspace_id_outcome_idx" ON "freelancer_bid_snapshots"("workspace_id", "outcome");

-- CreateIndex
CREATE INDEX "freelancer_bid_snapshots_workspace_id_submitted_at_idx" ON "freelancer_bid_snapshots"("workspace_id", "submitted_at");

-- CreateIndex
CREATE INDEX "freelancer_bid_snapshots_project_id_idx" ON "freelancer_bid_snapshots"("project_id");

-- AddForeignKey
ALTER TABLE "freelancer_bid_snapshots" ADD CONSTRAINT "freelancer_bid_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
