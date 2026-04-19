import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCoursePackReviewDiff,
  buildCoursePackRereviewQueue,
} from "../src/lib/course-pack-diff.ts";

test("surfaces pending refresh document changes before a fresh extraction", () => {
  const diff = buildCoursePackReviewDiff({
    coursePack: {
      driftStatus: "pending_refresh",
      driftReasonCodes: ["documents_added", "document_roles_changed"],
      requiresReconfirmation: false,
      activeContextState: "stale",
    } as never,
    extraction: null,
    confirmation: null,
  });

  assert.equal(diff.documentChanges.added, true);
  assert.equal(diff.documentChanges.roleChanged, true);
  assert.equal(diff.reviewStatus, "refresh_extraction");
  assert.match(diff.reviewStatusText, /Extraction/u);
});

test("surfaces meaningful unit, concept, blueprint, and support-level drift", () => {
  const diff = buildCoursePackReviewDiff({
    coursePack: {
      driftStatus: "review_required",
      driftReasonCodes: [
        "course_graph_changed",
        "exam_blueprint_changed",
        "support_level_changed",
      ],
      requiresReconfirmation: true,
      activeContextState: "stale",
    } as never,
    confirmation: {
      extractionSnapshotId: "old-extraction",
      supportLevelCandidate: "planning_review",
      baselineBlueprintAreas: [
        {
          blueprintAreaId: "area-1",
          label: "Functions",
          priorityTier: "medium",
          practiceNeed: "medium",
          recurrenceSignal: "weak",
          suggestedTimeSharePct: 30,
          confidenceScore: 0.6,
        },
      ],
      units: [
        {
          sourceUnitCandidateId: "unit-1",
          label: "Functions",
          sequenceOrder: 1,
          importanceTier: "core",
        },
      ],
      concepts: [
        {
          sourceConceptCandidateId: "concept-1",
          label: "Parameters",
          sequenceOrder: 1,
          assessmentRelevance: "medium",
          coachabilityStatus: "partially_supported",
        },
      ],
    } as never,
    extraction: {
      extractionSnapshotId: "new-extraction",
      supportLevelAssessment: {
        candidateSupportLevel: "guided_study",
      },
      courseGraph: {
        units: [
          {
            sourceUnitCandidateId: "unit-1",
            label: "Function Design",
            sequenceOrder: 1,
            importanceTier: "core",
          },
          {
            sourceUnitCandidateId: "unit-2",
            label: "Testing",
            sequenceOrder: 2,
            importanceTier: "supporting",
          },
        ],
        concepts: [
          {
            sourceConceptCandidateId: "concept-1",
            label: "Argument Matching",
            sequenceOrder: 1,
            assessmentRelevance: "high",
            coachabilityStatus: "coachable",
          },
          {
            sourceConceptCandidateId: "concept-2",
            label: "Assertions",
            sequenceOrder: 2,
            assessmentRelevance: "medium",
            coachabilityStatus: "coachable",
          },
        ],
      },
      examBlueprint: {
        areas: [
          {
            blueprintAreaId: "area-2",
            label: "Function Design",
            priorityTier: "high",
            practiceNeed: "high",
            recurrenceSignal: "strong",
            suggestedTimeSharePct: 55,
            confidenceScore: 0.83,
          },
        ],
      },
    } as never,
  });

  assert.equal(diff.reviewStatus, "review_required");
  assert.equal(diff.extractionChangedMaterially, true);
  assert.equal(diff.changedUnits.changed.length, 1);
  assert.equal(diff.changedUnits.added.length, 1);
  assert.equal(diff.changedConcepts.changed.length, 1);
  assert.equal(diff.changedConcepts.added.length, 1);
  assert.equal(diff.changedBlueprintAreas.added.length, 1);
  assert.equal(diff.changedBlueprintAreas.removed.length, 1);
  assert.deepEqual(diff.supportLevelImpact, {
    before: "planning_review",
    after: "guided_study",
  });
});

test("surfaces activation refresh without forcing re-review when the review is still valid", () => {
  const diff = buildCoursePackReviewDiff({
    coursePack: {
      driftStatus: "clean",
      driftReasonCodes: ["activation_refresh_required"],
      requiresReconfirmation: false,
      activeContextState: "stale",
    } as never,
    confirmation: {
      extractionSnapshotId: "same-extraction",
      supportLevelCandidate: "guided_study",
      baselineBlueprintAreas: [],
      units: [],
      concepts: [],
    } as never,
    extraction: {
      extractionSnapshotId: "same-extraction",
      supportLevelAssessment: {
        candidateSupportLevel: "guided_study",
      },
      courseGraph: {
        units: [],
        concepts: [],
      },
      examBlueprint: {
        areas: [],
      },
    } as never,
  });

  assert.equal(diff.reviewStatus, "refresh_activation");
  assert.equal(diff.extractionChangedMaterially, false);
  assert.equal(diff.supportLevelImpact, null);
});

test("prioritizes changed concepts, blueprint shifts, and support-level impact in the re-review queue", () => {
  const diff = buildCoursePackReviewDiff({
    coursePack: {
      driftStatus: "review_required",
      driftReasonCodes: [
        "course_graph_changed",
        "exam_blueprint_changed",
        "support_level_changed",
      ],
      requiresReconfirmation: true,
      activeContextState: "stale",
    } as never,
    confirmation: {
      extractionSnapshotId: "old-extraction",
      supportLevelCandidate: "planning_review",
      baselineBlueprintAreas: [
        {
          blueprintAreaId: "area-1",
          label: "Variables",
          priorityTier: "high",
          practiceNeed: "medium",
          recurrenceSignal: "moderate",
          suggestedTimeSharePct: 60,
          confidenceScore: 0.7,
        },
      ],
      units: [],
      concepts: [
        {
          sourceConceptCandidateId: "concept-1",
          label: "Variables",
          sequenceOrder: 1,
          assessmentRelevance: "high",
          coachabilityStatus: "coachable",
          isExamImportant: true,
          referencedBlueprintAreaIds: ["area-1"],
        },
      ],
    } as never,
    extraction: {
      extractionSnapshotId: "new-extraction",
      supportLevelAssessment: {
        candidateSupportLevel: "guided_study",
      },
      courseGraph: {
        units: [
          {
            sourceUnitCandidateId: "unit-1",
            label: "Variables and Loops",
            sequenceOrder: 1,
            importanceTier: "core",
          },
        ],
        concepts: [
          {
            sourceConceptCandidateId: "concept-1",
            label: "Variables",
            sequenceOrder: 1,
            assessmentRelevance: "high",
            coachabilityStatus: "coachable",
          },
          {
            sourceConceptCandidateId: "concept-2",
            label: "Loops",
            sequenceOrder: 2,
            assessmentRelevance: "high",
            coachabilityStatus: "coachable",
          },
        ],
      },
      examBlueprint: {
        areas: [
          {
            blueprintAreaId: "area-2",
            label: "Loops",
            priorityTier: "high",
            practiceNeed: "high",
            recurrenceSignal: "strong",
            suggestedTimeSharePct: 55,
            confidenceScore: 0.9,
          },
        ],
      },
    } as never,
  });

  const queue = buildCoursePackRereviewQueue({
    reviewDiff: diff,
    confirmation: {
      concepts: [
        {
          sourceConceptCandidateId: "concept-1",
          isExamImportant: true,
          referencedBlueprintAreaIds: ["area-1"],
        },
      ],
    } as never,
    extraction: {
      courseGraph: {
        concepts: [
          {
            sourceConceptCandidateId: "concept-2",
            assessmentRelevance: "high",
          },
        ],
      },
    } as never,
  });

  assert.equal(queue.items[0]?.kind, "support_level");
  assert.equal(queue.items[0]?.status, "needs_explicit_confirmation");
  assert.equal(queue.reviewableCount > 0, true);
  assert.equal(queue.remainingReviewCount, queue.reviewableCount);
  assert.equal(queue.items.some((item) => item.kind === "blueprint"), true);
  assert.equal(queue.items.some((item) => item.sourceId === "concept-2"), true);
});

test("marks changed items reviewed without blocking activation refresh when only the active context is stale", () => {
  const diff = buildCoursePackReviewDiff({
    coursePack: {
      driftStatus: "clean",
      driftReasonCodes: ["activation_refresh_required"],
      requiresReconfirmation: false,
      activeContextState: "stale",
    } as never,
    confirmation: {
      extractionSnapshotId: "same-extraction",
      supportLevelCandidate: "guided_study",
      baselineBlueprintAreas: [],
      units: [],
      concepts: [],
    } as never,
    extraction: {
      extractionSnapshotId: "same-extraction",
      supportLevelAssessment: {
        candidateSupportLevel: "guided_study",
      },
      courseGraph: {
        units: [],
        concepts: [],
      },
      examBlueprint: {
        areas: [],
      },
    } as never,
  });

  const queue = buildCoursePackRereviewQueue({
    reviewDiff: diff,
    confirmation: null,
    extraction: null,
    reviewedItemIds: [],
  });

  assert.equal(queue.reviewableCount, 0);
  assert.equal(queue.remainingReviewCount, 0);
  assert.equal(queue.activationRefreshRequired, true);
  assert.equal(queue.items[0]?.status, "needs_activation_refresh");
});
