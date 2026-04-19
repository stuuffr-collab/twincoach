import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ExamBlueprintPriorityTier } from "@prisma/client";
import {
  deriveChangedConfirmedConceptIdsForRefresh,
  selectFocusCompiledConcept,
} from "../src/modules/course-pack/course-pack-refresh-handoff";

test("derives changed confirmed concepts for post-update refresh from persisted confirmations only", () => {
  const changedIds = deriveChangedConfirmedConceptIdsForRefresh({
    previousConfirmationSnapshot: {
      concepts: [
        {
          id: "old-confirmed-variables",
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
          id: "new-confirmed-variables",
          sourceConceptCandidateId: "concept-variables",
          label: "Variables",
          sequenceOrder: 1,
          assessmentRelevance: "high",
          isExamImportant: true,
          engineConceptId: "py_c01_variables",
          referencedBlueprintAreaIds: ["area-1"],
        },
        {
          id: "new-confirmed-loops",
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

  assert.deepEqual(changedIds, ["new-confirmed-loops"]);
});

test("prioritizes changed confirmed concepts when selecting the refreshed focus concept", () => {
  const focusConcept = selectFocusCompiledConcept(
    [
      {
        id: "compiled-variables",
        sourceConfirmedConceptId: "new-confirmed-variables",
        engineConceptId: "py_c01_variables",
        isExamImportant: true,
        priorityTier: ExamBlueprintPriorityTier.high,
        suggestedTimeSharePct: 70,
        sequenceOrder: 1,
      },
      {
        id: "compiled-loops",
        sourceConfirmedConceptId: "new-confirmed-loops",
        engineConceptId: "py_c03_loops",
        isExamImportant: false,
        priorityTier: ExamBlueprintPriorityTier.medium,
        suggestedTimeSharePct: 45,
        sequenceOrder: 2,
      },
    ],
    ["new-confirmed-loops"],
  );

  assert.equal(focusConcept?.id, "compiled-loops");
});
