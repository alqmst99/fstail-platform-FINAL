-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('POSTULADO', 'EN_CONVERSACION', 'ADJUDICADO_A_MIME', 'ADJUDICADO_A_OTRO', 'CANCELADO', 'NO_ADJUDICADO');

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "freelancer_proj_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "raw_description" TEXT NOT NULL,
    "translated_desc" TEXT,
    "client_country" TEXT,
    "client_hire_rate" DOUBLE PRECISION,
    "client_spent" DOUBLE PRECISION,
    "avg_bid_price" DOUBLE PRECISION NOT NULL,
    "recommended_price" DOUBLE PRECISION NOT NULL,
    "submitted_price" DOUBLE PRECISION NOT NULL,
    "submitted_days" INTEGER NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'POSTULADO',
    "winner_bid_price" DOUBLE PRECISION,
    "winner_rating" DOUBLE PRECISION,
    "winner_reviews_count" INTEGER,
    "proposal_text" TEXT NOT NULL,
    "attachments_text" TEXT,
    "assigned_to_user_tag" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "external_id" TEXT,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_tasks" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_tag" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "time_spent_min" INTEGER NOT NULL DEFAULT 0,
    "date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "energy_level" INTEGER,
    "notes" TEXT,

    CONSTRAINT "daily_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_freelancer_proj_id_key" ON "applications"("freelancer_proj_id");

-- CreateIndex
CREATE INDEX "applications_workspace_id_status_idx" ON "applications"("workspace_id", "status");

-- CreateIndex
CREATE INDEX "applications_assigned_to_user_tag_idx" ON "applications"("assigned_to_user_tag");

-- CreateIndex
CREATE INDEX "messages_application_id_timestamp_idx" ON "messages"("application_id", "timestamp");

-- CreateIndex
CREATE INDEX "daily_tasks_workspace_id_user_tag_date_idx" ON "daily_tasks"("workspace_id", "user_tag", "date");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_tasks" ADD CONSTRAINT "daily_tasks_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
