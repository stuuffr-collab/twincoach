-- CreateEnum
CREATE TYPE "CoursePackLifecycleState" AS ENUM ('draft', 'ingesting', 'classifying', 'extracting', 'awaiting_confirmation', 'confirmed', 'active', 'archived', 'failed');

-- CreateEnum
CREATE TYPE "CoursePackReadinessState" AS ENUM ('awaiting_documents', 'awaiting_roles', 'awaiting_extraction', 'review_ready', 'activation_ready', 'blocked');

-- CreateEnum
CREATE TYPE "CoursePackSupportLevel" AS ENUM ('full_coach', 'guided_study', 'planning_review', 'not_ready');

-- CreateEnum
CREATE TYPE "SourceDocumentValidationStatus" AS ENUM ('queued', 'valid', 'rejected');

-- CreateEnum
CREATE TYPE "SourceDocumentParseStatus" AS ENUM ('queued', 'validating', 'validated', 'parsing', 'parsed', 'partial', 'failed', 'blocked');

-- CreateEnum
CREATE TYPE "SourceDocumentRole" AS ENUM ('syllabus', 'lecture_notes', 'slides', 'past_exam', 'lab_sheet', 'assignment', 'reference', 'other', 'unknown');

-- CreateTable
CREATE TABLE "CoursePack" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "courseCode" TEXT,
    "institutionLabel" TEXT,
    "termLabel" TEXT,
    "primaryLanguage" TEXT NOT NULL,
    "lifecycleState" "CoursePackLifecycleState" NOT NULL DEFAULT 'draft',
    "readinessState" "CoursePackReadinessState" NOT NULL DEFAULT 'awaiting_documents',
    "supportLevelCandidate" "CoursePackSupportLevel",
    "supportLevelFinal" "CoursePackSupportLevel",
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activeConfirmationSnapshotId" TEXT,
    "documentCount" INTEGER NOT NULL DEFAULT 0,
    "confirmedUnitCount" INTEGER NOT NULL DEFAULT 0,
    "confirmedConceptCount" INTEGER NOT NULL DEFAULT 0,
    "unsupportedTopicCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CoursePack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "coursePackId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "checksumSha256" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validationStatus" "SourceDocumentValidationStatus" NOT NULL DEFAULT 'queued',
    "suggestedRole" "SourceDocumentRole",
    "confirmedRole" "SourceDocumentRole",
    "roleConfidenceScore" DOUBLE PRECISION,
    "roleReasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "alternateRoleCandidates" JSONB,
    "parseStatus" "SourceDocumentParseStatus" NOT NULL DEFAULT 'queued',
    "parseConfidenceScore" DOUBLE PRECISION,
    "hasSelectableText" BOOLEAN,
    "textCoverageRatio" DOUBLE PRECISION,
    "textPreview" TEXT,
    "warningCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockingIssueCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoursePack_learnerId_idx" ON "CoursePack"("learnerId");

-- CreateIndex
CREATE INDEX "CoursePack_learnerId_isActive_idx" ON "CoursePack"("learnerId", "isActive");

-- CreateIndex
CREATE INDEX "CoursePack_lifecycleState_idx" ON "CoursePack"("lifecycleState");

-- CreateIndex
CREATE INDEX "CoursePack_readinessState_idx" ON "CoursePack"("readinessState");

-- CreateIndex
CREATE INDEX "SourceDocument_coursePackId_idx" ON "SourceDocument"("coursePackId");

-- CreateIndex
CREATE INDEX "SourceDocument_suggestedRole_idx" ON "SourceDocument"("suggestedRole");

-- CreateIndex
CREATE INDEX "SourceDocument_confirmedRole_idx" ON "SourceDocument"("confirmedRole");

-- CreateIndex
CREATE INDEX "SourceDocument_validationStatus_idx" ON "SourceDocument"("validationStatus");

-- CreateIndex
CREATE INDEX "SourceDocument_parseStatus_idx" ON "SourceDocument"("parseStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_coursePackId_checksumSha256_key" ON "SourceDocument"("coursePackId", "checksumSha256");

-- AddForeignKey
ALTER TABLE "CoursePack" ADD CONSTRAINT "CoursePack_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_coursePackId_fkey" FOREIGN KEY ("coursePackId") REFERENCES "CoursePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
