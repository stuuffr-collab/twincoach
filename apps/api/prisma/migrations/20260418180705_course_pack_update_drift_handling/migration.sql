-- CreateEnum
CREATE TYPE "CoursePackDriftStatus" AS ENUM ('clean', 'pending_refresh', 'review_required');

-- CreateEnum
CREATE TYPE "CoursePackActiveContextState" AS ENUM ('current', 'stale');

-- AlterTable
ALTER TABLE "CoursePack" ADD COLUMN     "activeContextState" "CoursePackActiveContextState" NOT NULL DEFAULT 'current',
ADD COLUMN     "driftReasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "driftStatus" "CoursePackDriftStatus" NOT NULL DEFAULT 'clean',
ADD COLUMN     "requiresReconfirmation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SourceDocument" ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedReasonCode" TEXT;

-- CreateIndex
CREATE INDEX "CoursePack_driftStatus_idx" ON "CoursePack"("driftStatus");

-- CreateIndex
CREATE INDEX "SourceDocument_removedAt_idx" ON "SourceDocument"("removedAt");
