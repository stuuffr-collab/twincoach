import assert from "node:assert/strict";
import test from "node:test";
import {
  CoursePackCoachabilityStatus,
  CoursePackDependencyEdgeType,
  ExtractionAssessmentRelevanceTier,
  ExtractionCoverageStatus,
  ExtractionDifficultyTier,
  ExtractionImportanceTier,
  UnsupportedTopicHandling,
} from "@prisma/client";
import { CoursePackGraphService } from "../src/modules/course-pack/course-pack-graph.service";
import { DraftExtractionArtifact } from "../src/modules/course-pack/course-pack.types";

test("builds a graph with evidence-backed merges and excludes low-confidence concepts", () => {
  const service = new CoursePackGraphService();
  const artifact: DraftExtractionArtifact = {
    coverageStatus: ExtractionCoverageStatus.partial,
    averageConfidenceScore: 0.71,
    lowConfidenceItemCount: 1,
    warningCodes: [],
    sourceEvidences: [
      {
        tempId: "e1",
        documentId: "doc-1",
        pageStart: 1,
        pageEnd: 1,
        evidenceType: "unit_heading",
        snippet: "Unit 1: Variables",
      },
      {
        tempId: "e2",
        documentId: "doc-1",
        pageStart: 1,
        pageEnd: 1,
        evidenceType: "concept_signal",
        snippet: "Concepts: Variables, Variables",
      },
      {
        tempId: "e3",
        documentId: "doc-2",
        pageStart: 1,
        pageEnd: 1,
        evidenceType: "fallback_keyword",
        snippet: "Background reference appendix",
      },
      {
        tempId: "e4",
        documentId: "doc-1",
        pageStart: 2,
        pageEnd: 2,
        evidenceType: "dependency_signal",
        snippet: "Variables before loops",
      },
      {
        tempId: "e5",
        documentId: "doc-1",
        pageStart: 2,
        pageEnd: 2,
        evidenceType: "concept_signal",
        snippet: "Concepts: Loops",
      },
    ],
    units: [
      {
        tempId: "u1",
        rawTitle: "Variables",
        normalizedTitle: "variables",
        sequenceOrderCandidate: 1,
        importanceTierCandidate: ExtractionImportanceTier.core,
        confidenceScore: 0.9,
        sourceEvidenceTempIds: ["e1"],
      },
    ],
    concepts: [
      {
        tempId: "c1",
        unitTempId: "u1",
        rawLabel: "Variables",
        learnerLabelCandidate: "Variables",
        normalizedLabel: "variables",
        sequenceOrderCandidate: 1,
        difficultyTierCandidate: ExtractionDifficultyTier.unknown,
        importanceTierCandidate: ExtractionImportanceTier.core,
        assessmentRelevanceCandidate: ExtractionAssessmentRelevanceTier.high,
        canonicalMappingCandidate: "programming_v1:variables",
        mappingConfidenceScore: 0.9,
        coachabilityStatus: CoursePackCoachabilityStatus.coachable,
        sourceEvidenceTempIds: ["e2"],
      },
      {
        tempId: "c2",
        unitTempId: "u1",
        rawLabel: "Variables",
        learnerLabelCandidate: "Variables",
        normalizedLabel: "variables",
        sequenceOrderCandidate: 2,
        difficultyTierCandidate: ExtractionDifficultyTier.unknown,
        importanceTierCandidate: ExtractionImportanceTier.core,
        assessmentRelevanceCandidate: ExtractionAssessmentRelevanceTier.high,
        canonicalMappingCandidate: "programming_v1:variables",
        mappingConfidenceScore: 0.9,
        coachabilityStatus: CoursePackCoachabilityStatus.coachable,
        sourceEvidenceTempIds: ["e2"],
      },
      {
        tempId: "c3",
        unitTempId: "u1",
        rawLabel: "Loops",
        learnerLabelCandidate: "Loops",
        normalizedLabel: "loops",
        sequenceOrderCandidate: 3,
        difficultyTierCandidate: ExtractionDifficultyTier.medium,
        importanceTierCandidate: ExtractionImportanceTier.supporting,
        assessmentRelevanceCandidate: ExtractionAssessmentRelevanceTier.medium,
        canonicalMappingCandidate: "programming_v1:loops",
        mappingConfidenceScore: 0.9,
        coachabilityStatus: CoursePackCoachabilityStatus.coachable,
        sourceEvidenceTempIds: ["e5"],
      },
      {
        tempId: "c4",
        unitTempId: "u1",
        rawLabel: "Appendix",
        learnerLabelCandidate: "Appendix",
        normalizedLabel: "appendix",
        sequenceOrderCandidate: 4,
        difficultyTierCandidate: ExtractionDifficultyTier.unknown,
        importanceTierCandidate: ExtractionImportanceTier.peripheral,
        assessmentRelevanceCandidate: ExtractionAssessmentRelevanceTier.low,
        canonicalMappingCandidate: null,
        mappingConfidenceScore: null,
        coachabilityStatus: CoursePackCoachabilityStatus.partially_supported,
        sourceEvidenceTempIds: ["e3"],
      },
    ],
    dependencyCandidates: [
      {
        tempId: "d1",
        fromConceptTempId: "c1",
        toConceptTempId: "c3",
        edgeType: CoursePackDependencyEdgeType.prerequisite,
        confidenceScore: 0.78,
        sourceEvidenceTempIds: ["e4"],
      },
    ],
    recurringThemes: [],
    unsupportedTopics: [
      {
        tempId: "ut1",
        rawLabel: "Reference bibliography",
        reasonCode: "non_instructional_content",
        sourceEvidenceTempIds: ["e3"],
        suggestedHandling: UnsupportedTopicHandling.unsupported,
      },
    ],
  };

  const graph = service.buildGraph(artifact);

  assert.equal(graph.units.length, 1);
  assert.equal(graph.concepts.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.equal(graph.concepts[0].mergedSourceConceptTempIds.length, 2);
  assert.equal(
    graph.concepts.some((concept) => concept.label === "Appendix"),
    false,
  );
  assert.ok(graph.edges[0].sourceEvidenceIds.length > 0);
});
