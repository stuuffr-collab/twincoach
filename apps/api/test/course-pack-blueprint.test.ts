import assert from "node:assert/strict";
import test from "node:test";
import { CoursePackBlueprintService } from "../src/modules/course-pack/course-pack-blueprint.service";
import {
  DraftCourseGraph,
  DraftExtractionArtifact,
} from "../src/modules/course-pack/course-pack.types";
import {
  CoursePackCoachabilityStatus,
  CoursePackDependencyEdgeType,
  ExtractionAssessmentRelevanceTier,
  ExtractionCoverageStatus,
  ExtractionDifficultyTier,
  ExtractionImportanceTier,
} from "@prisma/client";

test("builds blueprint areas with deterministic priority, recurrence, and time share", () => {
  const service = new CoursePackBlueprintService();
  const artifact: DraftExtractionArtifact = {
    coverageStatus: ExtractionCoverageStatus.complete,
    averageConfidenceScore: 0.81,
    lowConfidenceItemCount: 0,
    warningCodes: [],
    sourceEvidences: [],
    units: [],
    concepts: [],
    dependencyCandidates: [],
    recurringThemes: [
      {
        tempId: "theme-1",
        label: "Loops",
        frequencyScore: 0.9,
        relatedConceptTempIds: ["c2", "c3"],
        sourceEvidenceTempIds: ["e2", "e3"],
      },
    ],
    unsupportedTopics: [],
  };
  const graph: DraftCourseGraph = {
    averageConfidenceScore: 0.82,
    units: [
      {
        sourceUnitTempId: "u1",
        label: "Control Flow",
        sequenceOrder: 1,
        importanceTier: ExtractionImportanceTier.core,
        confidenceScore: 0.88,
        sourceEvidenceIds: ["e1"],
      },
      {
        sourceUnitTempId: "u2",
        label: "Review",
        sequenceOrder: 2,
        importanceTier: ExtractionImportanceTier.supporting,
        confidenceScore: 0.72,
        sourceEvidenceIds: ["e4"],
      },
    ],
    concepts: [
      {
        sourceConceptTempId: "c1",
        unitSourceTempId: "u1",
        label: "Conditionals",
        normalizedLabel: "conditionals",
        sequenceOrder: 1,
        difficultyTier: ExtractionDifficultyTier.medium,
        importanceTier: ExtractionImportanceTier.core,
        assessmentRelevance: ExtractionAssessmentRelevanceTier.high,
        coachabilityStatus: CoursePackCoachabilityStatus.coachable,
        canonicalTemplateId: "programming_v1:conditionals",
        mappingConfidenceScore: 0.9,
        mergedSourceConceptTempIds: ["c1"],
        sourceEvidenceIds: ["e1"],
        confidenceScore: 0.88,
      },
      {
        sourceConceptTempId: "c2",
        unitSourceTempId: "u1",
        label: "Loops",
        normalizedLabel: "loops",
        sequenceOrder: 2,
        difficultyTier: ExtractionDifficultyTier.high,
        importanceTier: ExtractionImportanceTier.core,
        assessmentRelevance: ExtractionAssessmentRelevanceTier.high,
        coachabilityStatus: CoursePackCoachabilityStatus.coachable,
        canonicalTemplateId: "programming_v1:loops",
        mappingConfidenceScore: 0.9,
        mergedSourceConceptTempIds: ["c2"],
        sourceEvidenceIds: ["e2"],
        confidenceScore: 0.91,
      },
      {
        sourceConceptTempId: "c3",
        unitSourceTempId: "u2",
        label: "Loops Review",
        normalizedLabel: "loops review",
        sequenceOrder: 3,
        difficultyTier: ExtractionDifficultyTier.medium,
        importanceTier: ExtractionImportanceTier.supporting,
        assessmentRelevance: ExtractionAssessmentRelevanceTier.medium,
        coachabilityStatus: CoursePackCoachabilityStatus.partially_supported,
        canonicalTemplateId: null,
        mappingConfidenceScore: null,
        mergedSourceConceptTempIds: ["c3"],
        sourceEvidenceIds: ["e3"],
        confidenceScore: 0.64,
      },
    ],
    edges: [
      {
        sourceDependencyTempId: "d1",
        fromConceptSourceTempId: "c1",
        toConceptSourceTempId: "c2",
        edgeType: CoursePackDependencyEdgeType.prerequisite,
        confidenceScore: 0.77,
        sourceEvidenceIds: ["e1"],
      },
    ],
  };

  const blueprint = service.buildBlueprint(artifact, graph);
  const totalTimeShare = blueprint.areas.reduce(
    (sum, area) => sum + area.suggestedTimeSharePct,
    0,
  );

  assert.equal(blueprint.areas.length, 2);
  assert.equal(totalTimeShare, 100);
  assert.equal(blueprint.areas[0].priorityTier, "high");
  assert.equal(blueprint.areas[0].practiceNeed, "high");
  assert.ok(
    ["strong", "moderate"].includes(blueprint.areas[0].recurrenceSignal),
  );
});
