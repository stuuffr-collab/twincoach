import assert from "node:assert/strict";
import test from "node:test";
import {
  CoursePackCoachabilityStatus,
  CoursePackSupportLevel,
  ExtractionAssessmentRelevanceTier,
  ExtractionCoverageStatus,
  ExtractionDifficultyTier,
  ExtractionImportanceTier,
  SourceDocumentParseStatus,
  SourceDocumentRole,
  SourceDocumentValidationStatus,
} from "@prisma/client";
import { CoursePackSupportLevelService } from "../src/modules/course-pack/course-pack-support-level.service";
import { DraftCourseGraph, DraftExamBlueprint, DraftExtractionArtifact } from "../src/modules/course-pack/course-pack.types";

test("assigns full coach candidate when stored signals meet the strict thresholds", () => {
  const service = new CoursePackSupportLevelService();
  const assessment = service.buildCandidateAssessment({
    documents: [
      buildDocument({
        confirmedRole: SourceDocumentRole.syllabus,
        parseConfidenceScore: 0.9,
      }),
      buildDocument({
        confirmedRole: SourceDocumentRole.lecture_notes,
        parseConfidenceScore: 0.88,
      }),
      buildDocument({
        confirmedRole: SourceDocumentRole.past_exam,
        parseConfidenceScore: 0.91,
      }),
    ],
    artifact: buildArtifact(ExtractionCoverageStatus.complete),
    graph: buildGraph({
      canonicalCount: 4,
      totalCount: 4,
      averageConfidenceScore: 0.84,
    }),
    blueprint: buildBlueprint(0.82),
  });

  assert.equal(assessment.candidateSupportLevel, CoursePackSupportLevel.full_coach);
});

test("assigns planning review when extraction is usable but evaluation reliability is limited", () => {
  const service = new CoursePackSupportLevelService();
  const assessment = service.buildCandidateAssessment({
    documents: [
      buildDocument({
        confirmedRole: SourceDocumentRole.lecture_notes,
        parseConfidenceScore: 0.68,
      }),
      buildDocument({
        confirmedRole: SourceDocumentRole.reference,
        parseConfidenceScore: 0.66,
      }),
    ],
    artifact: buildArtifact(ExtractionCoverageStatus.partial),
    graph: buildGraph({
      canonicalCount: 0,
      totalCount: 4,
      averageConfidenceScore: 0.62,
    }),
    blueprint: buildBlueprint(0.57),
  });

  assert.equal(
    assessment.candidateSupportLevel,
    CoursePackSupportLevel.planning_review,
  );
});

test("assigns not ready when blocking issues or weak structure are present", () => {
  const service = new CoursePackSupportLevelService();
  const assessment = service.buildCandidateAssessment({
    documents: [
      buildDocument({
        confirmedRole: SourceDocumentRole.other,
        parseConfidenceScore: 0.4,
        validationStatus: SourceDocumentValidationStatus.rejected,
        parseStatus: SourceDocumentParseStatus.blocked,
        blockingIssueCode: "ocr_required",
      }),
    ],
    artifact: buildArtifact(ExtractionCoverageStatus.weak),
    graph: buildGraph({
      canonicalCount: 0,
      totalCount: 2,
      averageConfidenceScore: 0.4,
    }),
    blueprint: buildBlueprint(0.2),
  });

  assert.equal(assessment.candidateSupportLevel, CoursePackSupportLevel.not_ready);
});

function buildDocument(input: {
  confirmedRole: SourceDocumentRole;
  parseConfidenceScore: number;
  validationStatus?: SourceDocumentValidationStatus;
  parseStatus?: SourceDocumentParseStatus;
  blockingIssueCode?: string | null;
}) {
  return {
    id: "doc",
    coursePackId: "pack",
    storageKey: "storage",
    originalFilename: "course.pdf",
    mimeType: "application/pdf",
    byteSize: 10,
    pageCount: 5,
    checksumSha256: "checksum",
    uploadedAt: new Date(),
    validationStatus: input.validationStatus ?? SourceDocumentValidationStatus.valid,
    suggestedRole: input.confirmedRole,
    confirmedRole: input.confirmedRole,
    roleConfidenceScore: 0.9,
    roleReasonCodes: [],
    alternateRoleCandidates: null,
    parseStatus: input.parseStatus ?? SourceDocumentParseStatus.parsed,
    parseConfidenceScore: input.parseConfidenceScore,
    hasSelectableText: true,
    textCoverageRatio: 0.8,
    textPreview: "preview",
    warningCodes: [],
    blockingIssueCode: input.blockingIssueCode ?? null,
    removedAt: null,
    removedReasonCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function buildArtifact(
  coverageStatus: ExtractionCoverageStatus,
): DraftExtractionArtifact {
  return {
    coverageStatus,
    averageConfidenceScore: coverageStatus === ExtractionCoverageStatus.complete ? 0.84 : 0.61,
    lowConfidenceItemCount: coverageStatus === ExtractionCoverageStatus.complete ? 0 : 1,
    warningCodes: coverageStatus === ExtractionCoverageStatus.complete ? [] : ["sparse_assessment_signals"],
    sourceEvidences: [],
    units: [
      {
        tempId: "u1",
        rawTitle: "Unit 1",
        normalizedTitle: "unit 1",
        sequenceOrderCandidate: 1,
        importanceTierCandidate: ExtractionImportanceTier.core,
        confidenceScore: 0.88,
        sourceEvidenceTempIds: ["e1"],
      },
    ],
    concepts: [
      {
        tempId: "c1",
        unitTempId: "u1",
        rawLabel: "Concept 1",
        learnerLabelCandidate: "Concept 1",
        normalizedLabel: "concept 1",
        sequenceOrderCandidate: 1,
        difficultyTierCandidate: ExtractionDifficultyTier.medium,
        importanceTierCandidate: ExtractionImportanceTier.core,
        assessmentRelevanceCandidate: ExtractionAssessmentRelevanceTier.high,
        canonicalMappingCandidate: "programming_v1:variables",
        mappingConfidenceScore: 0.9,
        coachabilityStatus: CoursePackCoachabilityStatus.coachable,
        sourceEvidenceTempIds: ["e1"],
      },
      {
        tempId: "c2",
        unitTempId: "u1",
        rawLabel: "Concept 2",
        learnerLabelCandidate: "Concept 2",
        normalizedLabel: "concept 2",
        sequenceOrderCandidate: 2,
        difficultyTierCandidate: ExtractionDifficultyTier.medium,
        importanceTierCandidate: ExtractionImportanceTier.supporting,
        assessmentRelevanceCandidate: ExtractionAssessmentRelevanceTier.medium,
        canonicalMappingCandidate: null,
        mappingConfidenceScore: null,
        coachabilityStatus: CoursePackCoachabilityStatus.partially_supported,
        sourceEvidenceTempIds: ["e2"],
      },
      {
        tempId: "c3",
        unitTempId: "u1",
        rawLabel: "Concept 3",
        learnerLabelCandidate: "Concept 3",
        normalizedLabel: "concept 3",
        sequenceOrderCandidate: 3,
        difficultyTierCandidate: ExtractionDifficultyTier.unknown,
        importanceTierCandidate: ExtractionImportanceTier.supporting,
        assessmentRelevanceCandidate: ExtractionAssessmentRelevanceTier.low,
        canonicalMappingCandidate: null,
        mappingConfidenceScore: null,
        coachabilityStatus: CoursePackCoachabilityStatus.partially_supported,
        sourceEvidenceTempIds: ["e3"],
      },
    ],
    dependencyCandidates: [],
    recurringThemes: [],
    unsupportedTopics: [],
  };
}

function buildGraph(input: {
  canonicalCount: number;
  totalCount: number;
  averageConfidenceScore: number;
}): DraftCourseGraph {
  return {
    averageConfidenceScore: input.averageConfidenceScore,
    units: [
      {
        sourceUnitTempId: "u1",
        label: "Unit 1",
        sequenceOrder: 1,
        importanceTier: ExtractionImportanceTier.core,
        confidenceScore: input.averageConfidenceScore,
        sourceEvidenceIds: ["e1"],
      },
    ],
    concepts: Array.from({ length: input.totalCount }).map((_, index) => ({
      sourceConceptTempId: `c${index + 1}`,
      unitSourceTempId: "u1",
      label: `Concept ${index + 1}`,
      normalizedLabel: `concept ${index + 1}`,
      sequenceOrder: index + 1,
      difficultyTier:
        index === 0 ? ExtractionDifficultyTier.medium : ExtractionDifficultyTier.unknown,
      importanceTier:
        index === 0 ? ExtractionImportanceTier.core : ExtractionImportanceTier.supporting,
      assessmentRelevance:
        index === 0
          ? ExtractionAssessmentRelevanceTier.high
          : ExtractionAssessmentRelevanceTier.medium,
      coachabilityStatus:
        index < input.canonicalCount
          ? CoursePackCoachabilityStatus.coachable
          : CoursePackCoachabilityStatus.partially_supported,
      canonicalTemplateId:
        index < input.canonicalCount ? `programming_v1:${index + 1}` : null,
      mappingConfidenceScore: index < input.canonicalCount ? 0.9 : null,
      mergedSourceConceptTempIds: [`c${index + 1}`],
      sourceEvidenceIds: [`e${index + 1}`],
      confidenceScore: input.averageConfidenceScore,
    })),
    edges: [],
  };
}

function buildBlueprint(averageConfidenceScore: number): DraftExamBlueprint {
  return {
    averageConfidenceScore,
    areas: [
      {
        label: "Area 1",
        unitSourceTempIds: ["u1"],
        conceptSourceTempIds: ["c1", "c2", "c3"],
        priorityTier: "high",
        practiceNeed: "high",
        recurrenceSignal: "moderate",
        suggestedTimeSharePct: 100,
        confidenceScore: averageConfidenceScore,
        reasonCodes: ["priority_high"],
        sourceEvidenceIds: ["e1"],
      },
    ],
  };
}
