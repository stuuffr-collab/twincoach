-- CreateEnum
CREATE TYPE "ConfirmationSnapshotStatus" AS ENUM ('confirmed', 'superseded', 'activated');

-- CreateEnum
CREATE TYPE "CompiledCoachPackStatus" AS ENUM ('compiled', 'superseded');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "activeCoursePackId" TEXT,
ADD COLUMN     "focusCompiledConceptId" TEXT;

-- CreateTable
CREATE TABLE "ConfirmationSnapshot" (
    "id" TEXT NOT NULL,
    "coursePackId" TEXT NOT NULL,
    "extractionSnapshotId" TEXT NOT NULL,
    "supportLevelCandidate" "CoursePackSupportLevel" NOT NULL,
    "status" "ConfirmationSnapshotStatus" NOT NULL DEFAULT 'confirmed',
    "editedItemCount" INTEGER NOT NULL DEFAULT 0,
    "mergeActionCount" INTEGER NOT NULL DEFAULT 0,
    "lowConfidenceAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "lowConfidenceIncludedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "ConfirmationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfirmedCoursePackUnit" (
    "id" TEXT NOT NULL,
    "confirmationSnapshotId" TEXT NOT NULL,
    "sourceGraphUnitId" TEXT,
    "sourceUnitCandidateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "importanceTier" "ExtractionImportanceTier" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "isLowConfidence" BOOLEAN NOT NULL DEFAULT false,
    "sourceEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfirmedCoursePackUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfirmedCoursePackConcept" (
    "id" TEXT NOT NULL,
    "confirmationSnapshotId" TEXT NOT NULL,
    "unitId" TEXT,
    "sourceGraphConceptId" TEXT,
    "sourceConceptCandidateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "difficultyTier" "ExtractionDifficultyTier" NOT NULL,
    "importanceTier" "ExtractionImportanceTier" NOT NULL,
    "assessmentRelevance" "ExtractionAssessmentRelevanceTier" NOT NULL,
    "coachabilityStatus" "CoursePackCoachabilityStatus" NOT NULL,
    "canonicalTemplateId" TEXT,
    "engineConceptId" TEXT,
    "mappingConfidenceScore" DOUBLE PRECISION,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "isLowConfidence" BOOLEAN NOT NULL DEFAULT false,
    "isExamImportant" BOOLEAN NOT NULL DEFAULT false,
    "mergedSourceConceptCandidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "referencedBlueprintAreaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfirmedCoursePackConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompiledCoachPack" (
    "id" TEXT NOT NULL,
    "coursePackId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "confirmationSnapshotId" TEXT NOT NULL,
    "supportLevel" "CoursePackSupportLevel" NOT NULL,
    "focusCompiledConceptId" TEXT,
    "focusEngineConceptId" TEXT,
    "compilationStatus" "CompiledCoachPackStatus" NOT NULL DEFAULT 'compiled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "compiledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompiledCoachPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompiledCoachConcept" (
    "id" TEXT NOT NULL,
    "compiledCoachPackId" TEXT NOT NULL,
    "sourceConfirmedConceptId" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "coachabilityStatus" "CoursePackCoachabilityStatus" NOT NULL,
    "canonicalTemplateId" TEXT,
    "engineConceptId" TEXT,
    "priorityTier" "ExamBlueprintPriorityTier" NOT NULL,
    "suggestedTimeSharePct" INTEGER NOT NULL,
    "isExamImportant" BOOLEAN NOT NULL DEFAULT false,
    "sourceEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompiledCoachConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveCourseContext" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "coursePackId" TEXT NOT NULL,
    "compiledCoachPackId" TEXT NOT NULL,
    "confirmationSnapshotId" TEXT NOT NULL,
    "supportLevel" "CoursePackSupportLevel" NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "focusCompiledConceptId" TEXT,
    "focusEngineConceptId" TEXT,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiveCourseContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerCompiledCoachConceptState" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "coursePackId" TEXT NOT NULL,
    "compiledCoachConceptId" TEXT NOT NULL,
    "masteryState" "MasteryState" NOT NULL DEFAULT 'unknown',
    "recentErrorTag" "ProgrammingErrorTag",
    "lastObservedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerCompiledCoachConceptState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConfirmationSnapshot_coursePackId_idx" ON "ConfirmationSnapshot"("coursePackId");

-- CreateIndex
CREATE INDEX "ConfirmationSnapshot_extractionSnapshotId_idx" ON "ConfirmationSnapshot"("extractionSnapshotId");

-- CreateIndex
CREATE INDEX "ConfirmationSnapshot_status_idx" ON "ConfirmationSnapshot"("status");

-- CreateIndex
CREATE INDEX "ConfirmedCoursePackUnit_confirmationSnapshotId_idx" ON "ConfirmedCoursePackUnit"("confirmationSnapshotId");

-- CreateIndex
CREATE INDEX "ConfirmedCoursePackUnit_sourceGraphUnitId_idx" ON "ConfirmedCoursePackUnit"("sourceGraphUnitId");

-- CreateIndex
CREATE INDEX "ConfirmedCoursePackUnit_sourceUnitCandidateId_idx" ON "ConfirmedCoursePackUnit"("sourceUnitCandidateId");

-- CreateIndex
CREATE INDEX "ConfirmedCoursePackConcept_confirmationSnapshotId_idx" ON "ConfirmedCoursePackConcept"("confirmationSnapshotId");

-- CreateIndex
CREATE INDEX "ConfirmedCoursePackConcept_unitId_idx" ON "ConfirmedCoursePackConcept"("unitId");

-- CreateIndex
CREATE INDEX "ConfirmedCoursePackConcept_sourceGraphConceptId_idx" ON "ConfirmedCoursePackConcept"("sourceGraphConceptId");

-- CreateIndex
CREATE INDEX "ConfirmedCoursePackConcept_sourceConceptCandidateId_idx" ON "ConfirmedCoursePackConcept"("sourceConceptCandidateId");

-- CreateIndex
CREATE INDEX "ConfirmedCoursePackConcept_engineConceptId_idx" ON "ConfirmedCoursePackConcept"("engineConceptId");

-- CreateIndex
CREATE UNIQUE INDEX "CompiledCoachPack_confirmationSnapshotId_key" ON "CompiledCoachPack"("confirmationSnapshotId");

-- CreateIndex
CREATE INDEX "CompiledCoachPack_coursePackId_idx" ON "CompiledCoachPack"("coursePackId");

-- CreateIndex
CREATE INDEX "CompiledCoachPack_learnerId_idx" ON "CompiledCoachPack"("learnerId");

-- CreateIndex
CREATE INDEX "CompiledCoachPack_supportLevel_idx" ON "CompiledCoachPack"("supportLevel");

-- CreateIndex
CREATE INDEX "CompiledCoachConcept_compiledCoachPackId_idx" ON "CompiledCoachConcept"("compiledCoachPackId");

-- CreateIndex
CREATE INDEX "CompiledCoachConcept_sourceConfirmedConceptId_idx" ON "CompiledCoachConcept"("sourceConfirmedConceptId");

-- CreateIndex
CREATE INDEX "CompiledCoachConcept_engineConceptId_idx" ON "CompiledCoachConcept"("engineConceptId");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveCourseContext_learnerId_key" ON "ActiveCourseContext"("learnerId");

-- CreateIndex
CREATE INDEX "ActiveCourseContext_coursePackId_idx" ON "ActiveCourseContext"("coursePackId");

-- CreateIndex
CREATE INDEX "ActiveCourseContext_compiledCoachPackId_idx" ON "ActiveCourseContext"("compiledCoachPackId");

-- CreateIndex
CREATE INDEX "LearnerCompiledCoachConceptState_coursePackId_idx" ON "LearnerCompiledCoachConceptState"("coursePackId");

-- CreateIndex
CREATE INDEX "LearnerCompiledCoachConceptState_compiledCoachConceptId_idx" ON "LearnerCompiledCoachConceptState"("compiledCoachConceptId");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerCompiledCoachConceptState_learnerId_coursePackId_com_key" ON "LearnerCompiledCoachConceptState"("learnerId", "coursePackId", "compiledCoachConceptId");

-- CreateIndex
CREATE INDEX "Session_activeCoursePackId_idx" ON "Session"("activeCoursePackId");

-- CreateIndex
CREATE INDEX "Session_focusCompiledConceptId_idx" ON "Session"("focusCompiledConceptId");

-- AddForeignKey
ALTER TABLE "ConfirmationSnapshot" ADD CONSTRAINT "ConfirmationSnapshot_coursePackId_fkey" FOREIGN KEY ("coursePackId") REFERENCES "CoursePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmationSnapshot" ADD CONSTRAINT "ConfirmationSnapshot_extractionSnapshotId_fkey" FOREIGN KEY ("extractionSnapshotId") REFERENCES "ExtractionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedCoursePackUnit" ADD CONSTRAINT "ConfirmedCoursePackUnit_confirmationSnapshotId_fkey" FOREIGN KEY ("confirmationSnapshotId") REFERENCES "ConfirmationSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedCoursePackUnit" ADD CONSTRAINT "ConfirmedCoursePackUnit_sourceGraphUnitId_fkey" FOREIGN KEY ("sourceGraphUnitId") REFERENCES "CourseGraphUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedCoursePackUnit" ADD CONSTRAINT "ConfirmedCoursePackUnit_sourceUnitCandidateId_fkey" FOREIGN KEY ("sourceUnitCandidateId") REFERENCES "ExtractedUnitCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedCoursePackConcept" ADD CONSTRAINT "ConfirmedCoursePackConcept_confirmationSnapshotId_fkey" FOREIGN KEY ("confirmationSnapshotId") REFERENCES "ConfirmationSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedCoursePackConcept" ADD CONSTRAINT "ConfirmedCoursePackConcept_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ConfirmedCoursePackUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedCoursePackConcept" ADD CONSTRAINT "ConfirmedCoursePackConcept_sourceGraphConceptId_fkey" FOREIGN KEY ("sourceGraphConceptId") REFERENCES "CourseGraphConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfirmedCoursePackConcept" ADD CONSTRAINT "ConfirmedCoursePackConcept_sourceConceptCandidateId_fkey" FOREIGN KEY ("sourceConceptCandidateId") REFERENCES "ExtractedConceptCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompiledCoachPack" ADD CONSTRAINT "CompiledCoachPack_coursePackId_fkey" FOREIGN KEY ("coursePackId") REFERENCES "CoursePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompiledCoachPack" ADD CONSTRAINT "CompiledCoachPack_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompiledCoachPack" ADD CONSTRAINT "CompiledCoachPack_confirmationSnapshotId_fkey" FOREIGN KEY ("confirmationSnapshotId") REFERENCES "ConfirmationSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompiledCoachPack" ADD CONSTRAINT "CompiledCoachPack_focusCompiledConceptId_fkey" FOREIGN KEY ("focusCompiledConceptId") REFERENCES "CompiledCoachConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompiledCoachConcept" ADD CONSTRAINT "CompiledCoachConcept_compiledCoachPackId_fkey" FOREIGN KEY ("compiledCoachPackId") REFERENCES "CompiledCoachPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompiledCoachConcept" ADD CONSTRAINT "CompiledCoachConcept_sourceConfirmedConceptId_fkey" FOREIGN KEY ("sourceConfirmedConceptId") REFERENCES "ConfirmedCoursePackConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveCourseContext" ADD CONSTRAINT "ActiveCourseContext_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveCourseContext" ADD CONSTRAINT "ActiveCourseContext_coursePackId_fkey" FOREIGN KEY ("coursePackId") REFERENCES "CoursePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveCourseContext" ADD CONSTRAINT "ActiveCourseContext_compiledCoachPackId_fkey" FOREIGN KEY ("compiledCoachPackId") REFERENCES "CompiledCoachPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveCourseContext" ADD CONSTRAINT "ActiveCourseContext_focusCompiledConceptId_fkey" FOREIGN KEY ("focusCompiledConceptId") REFERENCES "CompiledCoachConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerCompiledCoachConceptState" ADD CONSTRAINT "LearnerCompiledCoachConceptState_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerCompiledCoachConceptState" ADD CONSTRAINT "LearnerCompiledCoachConceptState_coursePackId_fkey" FOREIGN KEY ("coursePackId") REFERENCES "CoursePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerCompiledCoachConceptState" ADD CONSTRAINT "LearnerCompiledCoachConceptState_compiledCoachConceptId_fkey" FOREIGN KEY ("compiledCoachConceptId") REFERENCES "CompiledCoachConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeCoursePackId_fkey" FOREIGN KEY ("activeCoursePackId") REFERENCES "CoursePack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_focusCompiledConceptId_fkey" FOREIGN KEY ("focusCompiledConceptId") REFERENCES "CompiledCoachConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;
