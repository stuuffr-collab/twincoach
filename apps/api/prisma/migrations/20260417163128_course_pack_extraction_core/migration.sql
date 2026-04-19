-- CreateEnum
CREATE TYPE "ExtractionCoverageStatus" AS ENUM ('complete', 'partial', 'weak');

-- CreateEnum
CREATE TYPE "ExtractionImportanceTier" AS ENUM ('core', 'supporting', 'peripheral');

-- CreateEnum
CREATE TYPE "ExtractionDifficultyTier" AS ENUM ('low', 'medium', 'high', 'unknown');

-- CreateEnum
CREATE TYPE "ExtractionAssessmentRelevanceTier" AS ENUM ('high', 'medium', 'low', 'unknown');

-- CreateEnum
CREATE TYPE "CoursePackCoachabilityStatus" AS ENUM ('coachable', 'partially_supported', 'unsupported');

-- CreateEnum
CREATE TYPE "CoursePackDependencyEdgeType" AS ENUM ('prerequisite', 'supports', 'co_assessed');

-- CreateEnum
CREATE TYPE "ExamBlueprintPriorityTier" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "ExamBlueprintPracticeNeedTier" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "ExamBlueprintRecurrenceSignal" AS ENUM ('strong', 'moderate', 'weak', 'none');

-- CreateEnum
CREATE TYPE "UnsupportedTopicHandling" AS ENUM ('unsupported', 'partial_support');

-- CreateTable
CREATE TABLE "ExtractionSnapshot" (
    "id" TEXT NOT NULL,
    "coursePackId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "coverageStatus" "ExtractionCoverageStatus" NOT NULL,
    "averageConfidenceScore" DOUBLE PRECISION NOT NULL,
    "documentCount" INTEGER NOT NULL,
    "lowConfidenceItemCount" INTEGER NOT NULL DEFAULT 0,
    "warningCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceEvidence" (
    "id" TEXT NOT NULL,
    "extractionSnapshotId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageStart" INTEGER NOT NULL,
    "pageEnd" INTEGER NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedUnitCandidate" (
    "id" TEXT NOT NULL,
    "extractionSnapshotId" TEXT NOT NULL,
    "rawTitle" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "sequenceOrderCandidate" INTEGER NOT NULL,
    "importanceTierCandidate" "ExtractionImportanceTier" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "sourceEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedUnitCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedConceptCandidate" (
    "id" TEXT NOT NULL,
    "extractionSnapshotId" TEXT NOT NULL,
    "unitCandidateId" TEXT,
    "rawLabel" TEXT NOT NULL,
    "learnerLabelCandidate" TEXT NOT NULL,
    "sequenceOrderCandidate" INTEGER NOT NULL,
    "difficultyTierCandidate" "ExtractionDifficultyTier" NOT NULL,
    "importanceTierCandidate" "ExtractionImportanceTier" NOT NULL,
    "assessmentRelevanceCandidate" "ExtractionAssessmentRelevanceTier" NOT NULL,
    "canonicalMappingCandidate" TEXT,
    "mappingConfidenceScore" DOUBLE PRECISION,
    "coachabilityStatus" "CoursePackCoachabilityStatus" NOT NULL,
    "sourceEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedConceptCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedDependencyCandidate" (
    "id" TEXT NOT NULL,
    "extractionSnapshotId" TEXT NOT NULL,
    "fromConceptCandidateId" TEXT NOT NULL,
    "toConceptCandidateId" TEXT NOT NULL,
    "edgeType" "CoursePackDependencyEdgeType" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "sourceEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtractedDependencyCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringTheme" (
    "id" TEXT NOT NULL,
    "extractionSnapshotId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "frequencyScore" DOUBLE PRECISION NOT NULL,
    "relatedConceptCandidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnsupportedTopic" (
    "id" TEXT NOT NULL,
    "extractionSnapshotId" TEXT NOT NULL,
    "rawLabel" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "sourceEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestedHandling" "UnsupportedTopicHandling" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnsupportedTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGraph" (
    "id" TEXT NOT NULL,
    "coursePackId" TEXT NOT NULL,
    "extractionSnapshotId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "averageConfidenceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGraphUnit" (
    "id" TEXT NOT NULL,
    "courseGraphId" TEXT NOT NULL,
    "sourceUnitCandidateId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "importanceTier" "ExtractionImportanceTier" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "sourceEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGraphUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGraphConcept" (
    "id" TEXT NOT NULL,
    "courseGraphId" TEXT NOT NULL,
    "sourceConceptCandidateId" TEXT NOT NULL,
    "unitId" TEXT,
    "label" TEXT NOT NULL,
    "normalizedLabel" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "difficultyTier" "ExtractionDifficultyTier" NOT NULL,
    "importanceTier" "ExtractionImportanceTier" NOT NULL,
    "assessmentRelevance" "ExtractionAssessmentRelevanceTier" NOT NULL,
    "coachabilityStatus" "CoursePackCoachabilityStatus" NOT NULL,
    "canonicalTemplateId" TEXT,
    "mappingConfidenceScore" DOUBLE PRECISION,
    "mergedSourceConceptCandidateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGraphConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseGraphEdge" (
    "id" TEXT NOT NULL,
    "courseGraphId" TEXT NOT NULL,
    "sourceDependencyCandidateId" TEXT NOT NULL,
    "fromConceptId" TEXT NOT NULL,
    "toConceptId" TEXT NOT NULL,
    "edgeType" "CoursePackDependencyEdgeType" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "sourceEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseGraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamBlueprint" (
    "id" TEXT NOT NULL,
    "coursePackId" TEXT NOT NULL,
    "extractionSnapshotId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "averageConfidenceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamBlueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamBlueprintArea" (
    "id" TEXT NOT NULL,
    "examBlueprintId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unitIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "conceptIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priorityTier" "ExamBlueprintPriorityTier" NOT NULL,
    "practiceNeed" "ExamBlueprintPracticeNeedTier" NOT NULL,
    "recurrenceSignal" "ExamBlueprintRecurrenceSignal" NOT NULL,
    "suggestedTimeSharePct" INTEGER NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "reasonCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceEvidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamBlueprintArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportLevelAssessment" (
    "id" TEXT NOT NULL,
    "coursePackId" TEXT NOT NULL,
    "extractionSnapshotId" TEXT NOT NULL,
    "parseIntegrityScore" DOUBLE PRECISION NOT NULL,
    "structureConfidenceScore" DOUBLE PRECISION NOT NULL,
    "blueprintConfidenceScore" DOUBLE PRECISION NOT NULL,
    "packCompletenessScore" DOUBLE PRECISION NOT NULL,
    "coachableCoverageScore" DOUBLE PRECISION NOT NULL,
    "evaluationReliabilityScore" DOUBLE PRECISION NOT NULL,
    "candidateSupportLevel" "CoursePackSupportLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportLevelAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractionSnapshot_coursePackId_idx" ON "ExtractionSnapshot"("coursePackId");

-- CreateIndex
CREATE INDEX "ExtractionSnapshot_generatedAt_idx" ON "ExtractionSnapshot"("generatedAt");

-- CreateIndex
CREATE INDEX "SourceEvidence_extractionSnapshotId_idx" ON "SourceEvidence"("extractionSnapshotId");

-- CreateIndex
CREATE INDEX "SourceEvidence_documentId_idx" ON "SourceEvidence"("documentId");

-- CreateIndex
CREATE INDEX "ExtractedUnitCandidate_extractionSnapshotId_idx" ON "ExtractedUnitCandidate"("extractionSnapshotId");

-- CreateIndex
CREATE INDEX "ExtractedConceptCandidate_extractionSnapshotId_idx" ON "ExtractedConceptCandidate"("extractionSnapshotId");

-- CreateIndex
CREATE INDEX "ExtractedConceptCandidate_unitCandidateId_idx" ON "ExtractedConceptCandidate"("unitCandidateId");

-- CreateIndex
CREATE INDEX "ExtractedConceptCandidate_coachabilityStatus_idx" ON "ExtractedConceptCandidate"("coachabilityStatus");

-- CreateIndex
CREATE INDEX "ExtractedDependencyCandidate_extractionSnapshotId_idx" ON "ExtractedDependencyCandidate"("extractionSnapshotId");

-- CreateIndex
CREATE INDEX "ExtractedDependencyCandidate_fromConceptCandidateId_idx" ON "ExtractedDependencyCandidate"("fromConceptCandidateId");

-- CreateIndex
CREATE INDEX "ExtractedDependencyCandidate_toConceptCandidateId_idx" ON "ExtractedDependencyCandidate"("toConceptCandidateId");

-- CreateIndex
CREATE INDEX "RecurringTheme_extractionSnapshotId_idx" ON "RecurringTheme"("extractionSnapshotId");

-- CreateIndex
CREATE INDEX "UnsupportedTopic_extractionSnapshotId_idx" ON "UnsupportedTopic"("extractionSnapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseGraph_extractionSnapshotId_key" ON "CourseGraph"("extractionSnapshotId");

-- CreateIndex
CREATE INDEX "CourseGraph_coursePackId_idx" ON "CourseGraph"("coursePackId");

-- CreateIndex
CREATE INDEX "CourseGraphUnit_courseGraphId_idx" ON "CourseGraphUnit"("courseGraphId");

-- CreateIndex
CREATE INDEX "CourseGraphUnit_sourceUnitCandidateId_idx" ON "CourseGraphUnit"("sourceUnitCandidateId");

-- CreateIndex
CREATE INDEX "CourseGraphConcept_courseGraphId_idx" ON "CourseGraphConcept"("courseGraphId");

-- CreateIndex
CREATE INDEX "CourseGraphConcept_sourceConceptCandidateId_idx" ON "CourseGraphConcept"("sourceConceptCandidateId");

-- CreateIndex
CREATE INDEX "CourseGraphConcept_unitId_idx" ON "CourseGraphConcept"("unitId");

-- CreateIndex
CREATE INDEX "CourseGraphConcept_coachabilityStatus_idx" ON "CourseGraphConcept"("coachabilityStatus");

-- CreateIndex
CREATE INDEX "CourseGraphEdge_courseGraphId_idx" ON "CourseGraphEdge"("courseGraphId");

-- CreateIndex
CREATE INDEX "CourseGraphEdge_sourceDependencyCandidateId_idx" ON "CourseGraphEdge"("sourceDependencyCandidateId");

-- CreateIndex
CREATE INDEX "CourseGraphEdge_fromConceptId_idx" ON "CourseGraphEdge"("fromConceptId");

-- CreateIndex
CREATE INDEX "CourseGraphEdge_toConceptId_idx" ON "CourseGraphEdge"("toConceptId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamBlueprint_extractionSnapshotId_key" ON "ExamBlueprint"("extractionSnapshotId");

-- CreateIndex
CREATE INDEX "ExamBlueprint_coursePackId_idx" ON "ExamBlueprint"("coursePackId");

-- CreateIndex
CREATE INDEX "ExamBlueprintArea_examBlueprintId_idx" ON "ExamBlueprintArea"("examBlueprintId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportLevelAssessment_extractionSnapshotId_key" ON "SupportLevelAssessment"("extractionSnapshotId");

-- CreateIndex
CREATE INDEX "SupportLevelAssessment_coursePackId_idx" ON "SupportLevelAssessment"("coursePackId");

-- CreateIndex
CREATE INDEX "SupportLevelAssessment_candidateSupportLevel_idx" ON "SupportLevelAssessment"("candidateSupportLevel");

-- AddForeignKey
ALTER TABLE "ExtractionSnapshot" ADD CONSTRAINT "ExtractionSnapshot_coursePackId_fkey" FOREIGN KEY ("coursePackId") REFERENCES "CoursePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEvidence" ADD CONSTRAINT "SourceEvidence_extractionSnapshotId_fkey" FOREIGN KEY ("extractionSnapshotId") REFERENCES "ExtractionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceEvidence" ADD CONSTRAINT "SourceEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedUnitCandidate" ADD CONSTRAINT "ExtractedUnitCandidate_extractionSnapshotId_fkey" FOREIGN KEY ("extractionSnapshotId") REFERENCES "ExtractionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedConceptCandidate" ADD CONSTRAINT "ExtractedConceptCandidate_extractionSnapshotId_fkey" FOREIGN KEY ("extractionSnapshotId") REFERENCES "ExtractionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedConceptCandidate" ADD CONSTRAINT "ExtractedConceptCandidate_unitCandidateId_fkey" FOREIGN KEY ("unitCandidateId") REFERENCES "ExtractedUnitCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedDependencyCandidate" ADD CONSTRAINT "ExtractedDependencyCandidate_extractionSnapshotId_fkey" FOREIGN KEY ("extractionSnapshotId") REFERENCES "ExtractionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedDependencyCandidate" ADD CONSTRAINT "ExtractedDependencyCandidate_fromConceptCandidateId_fkey" FOREIGN KEY ("fromConceptCandidateId") REFERENCES "ExtractedConceptCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedDependencyCandidate" ADD CONSTRAINT "ExtractedDependencyCandidate_toConceptCandidateId_fkey" FOREIGN KEY ("toConceptCandidateId") REFERENCES "ExtractedConceptCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTheme" ADD CONSTRAINT "RecurringTheme_extractionSnapshotId_fkey" FOREIGN KEY ("extractionSnapshotId") REFERENCES "ExtractionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnsupportedTopic" ADD CONSTRAINT "UnsupportedTopic_extractionSnapshotId_fkey" FOREIGN KEY ("extractionSnapshotId") REFERENCES "ExtractionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGraph" ADD CONSTRAINT "CourseGraph_coursePackId_fkey" FOREIGN KEY ("coursePackId") REFERENCES "CoursePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGraph" ADD CONSTRAINT "CourseGraph_extractionSnapshotId_fkey" FOREIGN KEY ("extractionSnapshotId") REFERENCES "ExtractionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGraphUnit" ADD CONSTRAINT "CourseGraphUnit_courseGraphId_fkey" FOREIGN KEY ("courseGraphId") REFERENCES "CourseGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGraphUnit" ADD CONSTRAINT "CourseGraphUnit_sourceUnitCandidateId_fkey" FOREIGN KEY ("sourceUnitCandidateId") REFERENCES "ExtractedUnitCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGraphConcept" ADD CONSTRAINT "CourseGraphConcept_courseGraphId_fkey" FOREIGN KEY ("courseGraphId") REFERENCES "CourseGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGraphConcept" ADD CONSTRAINT "CourseGraphConcept_sourceConceptCandidateId_fkey" FOREIGN KEY ("sourceConceptCandidateId") REFERENCES "ExtractedConceptCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGraphConcept" ADD CONSTRAINT "CourseGraphConcept_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "CourseGraphUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGraphEdge" ADD CONSTRAINT "CourseGraphEdge_courseGraphId_fkey" FOREIGN KEY ("courseGraphId") REFERENCES "CourseGraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGraphEdge" ADD CONSTRAINT "CourseGraphEdge_sourceDependencyCandidateId_fkey" FOREIGN KEY ("sourceDependencyCandidateId") REFERENCES "ExtractedDependencyCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGraphEdge" ADD CONSTRAINT "CourseGraphEdge_fromConceptId_fkey" FOREIGN KEY ("fromConceptId") REFERENCES "CourseGraphConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseGraphEdge" ADD CONSTRAINT "CourseGraphEdge_toConceptId_fkey" FOREIGN KEY ("toConceptId") REFERENCES "CourseGraphConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamBlueprint" ADD CONSTRAINT "ExamBlueprint_coursePackId_fkey" FOREIGN KEY ("coursePackId") REFERENCES "CoursePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamBlueprint" ADD CONSTRAINT "ExamBlueprint_extractionSnapshotId_fkey" FOREIGN KEY ("extractionSnapshotId") REFERENCES "ExtractionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamBlueprintArea" ADD CONSTRAINT "ExamBlueprintArea_examBlueprintId_fkey" FOREIGN KEY ("examBlueprintId") REFERENCES "ExamBlueprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportLevelAssessment" ADD CONSTRAINT "SupportLevelAssessment_coursePackId_fkey" FOREIGN KEY ("coursePackId") REFERENCES "CoursePack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportLevelAssessment" ADD CONSTRAINT "SupportLevelAssessment_extractionSnapshotId_fkey" FOREIGN KEY ("extractionSnapshotId") REFERENCES "ExtractionSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
