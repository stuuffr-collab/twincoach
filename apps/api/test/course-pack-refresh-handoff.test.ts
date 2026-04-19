import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import {
  CoursePackSupportLevel,
  ExamBlueprintPriorityTier,
  MasteryState,
  ProgrammingErrorTag,
} from "@prisma/client";
import {
  deriveCoursePackRefreshContext,
  deriveChangedConfirmedConceptIdsForRefresh,
  shouldContinueRefreshFollowThrough,
} from "../src/modules/course-pack/course-pack-refresh-handoff";

test("derives new material refresh context when the refreshed focus comes from a newly added concept", () => {
  const refreshContext = deriveCoursePackRefreshContext({
    previousConfirmationSnapshot: {
      supportLevelCandidate: CoursePackSupportLevel.guided_study,
      concepts: [
        {
          id: "confirmed-variables-old",
          sourceConceptCandidateId: "concept-variables",
          label: "Variables",
          sequenceOrder: 1,
          assessmentRelevance: "high",
          isExamImportant: true,
          engineConceptId: "py_c01_variables",
          referencedBlueprintAreaIds: ["area-old-variables"],
        },
      ],
      extractionSnapshot: {
        examBlueprint: {
          areas: [
            {
              id: "area-old-variables",
              label: "Variables core",
              priorityTier: ExamBlueprintPriorityTier.high,
              suggestedTimeSharePct: 60,
            },
          ],
        },
      },
    } as never,
    currentConfirmationSnapshot: {
      supportLevelCandidate: CoursePackSupportLevel.guided_study,
      concepts: [
        {
          id: "confirmed-variables-new",
          sourceConceptCandidateId: "concept-variables",
          label: "Variables",
          sequenceOrder: 1,
          assessmentRelevance: "high",
          isExamImportant: true,
          engineConceptId: "py_c01_variables",
          referencedBlueprintAreaIds: ["area-new-variables"],
        },
        {
          id: "confirmed-loops-new",
          sourceConceptCandidateId: "concept-loops",
          label: "Loops",
          sequenceOrder: 2,
          assessmentRelevance: "high",
          isExamImportant: true,
          engineConceptId: "py_c03_loops",
          referencedBlueprintAreaIds: ["area-new-loops"],
        },
      ],
      extractionSnapshot: {
        examBlueprint: {
          areas: [
            {
              id: "area-new-variables",
              label: "Variables core",
              priorityTier: ExamBlueprintPriorityTier.medium,
              suggestedTimeSharePct: 35,
            },
            {
              id: "area-new-loops",
              label: "Loops focus",
              priorityTier: ExamBlueprintPriorityTier.high,
              suggestedTimeSharePct: 65,
            },
          ],
        },
      },
    } as never,
    focusCompiledConcept: {
      sourceConfirmedConceptId: "confirmed-loops-new",
      displayLabel: "Loops",
    },
  });

  assert.deepEqual(refreshContext, {
    reasonType: "new_material",
    sourceLabel: "Loops",
    previousSupportLevel: CoursePackSupportLevel.guided_study,
    currentSupportLevel: CoursePackSupportLevel.guided_study,
  });
});

test("derives support-level impact before lower-priority refresh reasons", () => {
  const refreshContext = deriveCoursePackRefreshContext({
    previousConfirmationSnapshot: {
      supportLevelCandidate: CoursePackSupportLevel.planning_review,
      concepts: [
        {
          id: "confirmed-tracing-old",
          sourceConceptCandidateId: "concept-tracing",
          label: "Tracing",
          sequenceOrder: 1,
          assessmentRelevance: "medium",
          isExamImportant: false,
          engineConceptId: null,
          referencedBlueprintAreaIds: ["area-old-tracing"],
        },
      ],
      extractionSnapshot: {
        examBlueprint: {
          areas: [
            {
              id: "area-old-tracing",
              label: "Tracing review",
              priorityTier: ExamBlueprintPriorityTier.medium,
              suggestedTimeSharePct: 45,
            },
          ],
        },
      },
    } as never,
    currentConfirmationSnapshot: {
      supportLevelCandidate: CoursePackSupportLevel.guided_study,
      concepts: [
        {
          id: "confirmed-tracing-new",
          sourceConceptCandidateId: "concept-tracing",
          label: "Tracing",
          sequenceOrder: 1,
          assessmentRelevance: "high",
          isExamImportant: true,
          engineConceptId: null,
          referencedBlueprintAreaIds: ["area-new-tracing"],
        },
      ],
      extractionSnapshot: {
        examBlueprint: {
          areas: [
            {
              id: "area-new-tracing",
              label: "Tracing review",
              priorityTier: ExamBlueprintPriorityTier.high,
              suggestedTimeSharePct: 70,
            },
          ],
        },
      },
    } as never,
    focusCompiledConcept: {
      sourceConfirmedConceptId: "confirmed-tracing-new",
      displayLabel: "Tracing",
    },
  });

  assert.deepEqual(refreshContext, {
    reasonType: "support_level_impact",
    sourceLabel: "Tracing",
    previousSupportLevel: CoursePackSupportLevel.planning_review,
    currentSupportLevel: CoursePackSupportLevel.guided_study,
  });
});

test("derives blueprint-priority refresh context when the same focus concept is reprioritized", () => {
  const refreshContext = deriveCoursePackRefreshContext({
    previousConfirmationSnapshot: {
      supportLevelCandidate: CoursePackSupportLevel.full_coach,
      concepts: [
        {
          id: "confirmed-functions-old",
          sourceConceptCandidateId: "concept-functions",
          label: "Functions",
          sequenceOrder: 3,
          assessmentRelevance: "high",
          isExamImportant: false,
          engineConceptId: "py_c04_functions",
          referencedBlueprintAreaIds: ["area-old-functions"],
        },
      ],
      extractionSnapshot: {
        examBlueprint: {
          areas: [
            {
              id: "area-old-functions",
              label: "Functions practice",
              priorityTier: ExamBlueprintPriorityTier.medium,
              suggestedTimeSharePct: 35,
            },
          ],
        },
      },
    } as never,
    currentConfirmationSnapshot: {
      supportLevelCandidate: CoursePackSupportLevel.full_coach,
      concepts: [
        {
          id: "confirmed-functions-new",
          sourceConceptCandidateId: "concept-functions",
          label: "Functions",
          sequenceOrder: 3,
          assessmentRelevance: "high",
          isExamImportant: true,
          engineConceptId: "py_c04_functions",
          referencedBlueprintAreaIds: ["area-new-functions"],
        },
      ],
      extractionSnapshot: {
        examBlueprint: {
          areas: [
            {
              id: "area-new-functions",
              label: "Functions practice",
              priorityTier: ExamBlueprintPriorityTier.high,
              suggestedTimeSharePct: 60,
            },
          ],
        },
      },
    } as never,
    focusCompiledConcept: {
      sourceConfirmedConceptId: "confirmed-functions-new",
      displayLabel: "Functions",
    },
  });

  assert.deepEqual(refreshContext, {
    reasonType: "changed_blueprint_priority",
    sourceLabel: "Functions practice",
    previousSupportLevel: CoursePackSupportLevel.full_coach,
    currentSupportLevel: CoursePackSupportLevel.full_coach,
  });
});

test("keeps changed concept detection stable for activation focus prioritization", () => {
  const changedIds = deriveChangedConfirmedConceptIdsForRefresh({
    previousConfirmationSnapshot: {
      concepts: [
        {
          id: "old-variables",
          sourceConceptCandidateId: "concept-variables",
          label: "Variables",
          sequenceOrder: 1,
          assessmentRelevance: "high",
          isExamImportant: true,
          engineConceptId: "py_c01_variables",
          referencedBlueprintAreaIds: ["area-1"],
        },
      ],
    } as never,
    currentConfirmationSnapshot: {
      concepts: [
        {
          id: "new-variables",
          sourceConceptCandidateId: "concept-variables",
          label: "Variables",
          sequenceOrder: 1,
          assessmentRelevance: "high",
          isExamImportant: true,
          engineConceptId: "py_c01_variables",
          referencedBlueprintAreaIds: ["area-1"],
        },
        {
          id: "new-loops",
          sourceConceptCandidateId: "concept-loops",
          label: "Loops",
          sequenceOrder: 2,
          assessmentRelevance: "high",
          isExamImportant: false,
          engineConceptId: "py_c03_loops",
          referencedBlueprintAreaIds: ["area-2"],
        },
      ],
    } as never,
  });

  assert.deepEqual(changedIds, ["new-loops"]);
});

test("continues refresh follow-through when the refreshed concept still looks unstable", () => {
  const shouldContinue = shouldContinueRefreshFollowThrough({
    compiledConceptState: {
      masteryState: MasteryState.emerging,
      recentErrorTag: ProgrammingErrorTag.value_tracking_error,
    },
    incorrectCount: 0,
  });

  assert.equal(shouldContinue, true);
});

test("falls back to incorrect attempts when no compiled concept state is available", () => {
  const shouldContinue = shouldContinueRefreshFollowThrough({
    compiledConceptState: null,
    incorrectCount: 1,
  });

  assert.equal(shouldContinue, true);
});

test("stops refresh follow-through after a stable session", () => {
  const shouldContinue = shouldContinueRefreshFollowThrough({
    compiledConceptState: {
      masteryState: MasteryState.steady,
      recentErrorTag: null,
    },
    incorrectCount: 0,
  });

  assert.equal(shouldContinue, false);
});
