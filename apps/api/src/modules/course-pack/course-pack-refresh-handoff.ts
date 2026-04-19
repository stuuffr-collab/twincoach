import {
  CoursePackSupportLevel,
  ExamBlueprintPriorityTier,
  MasteryState,
  ProgrammingErrorTag,
} from "@prisma/client";
import { ConfirmationSnapshotWithRelations } from "./course-pack.query";

type MinimalConfirmationConcept = Pick<
  ConfirmationSnapshotWithRelations["concepts"][number],
  | "id"
  | "sourceConceptCandidateId"
  | "label"
  | "sequenceOrder"
  | "assessmentRelevance"
  | "isExamImportant"
  | "engineConceptId"
  | "referencedBlueprintAreaIds"
>;

type MinimalBlueprintArea = {
  id: string;
  label: string;
  priorityTier: ExamBlueprintPriorityTier;
  suggestedTimeSharePct: number;
};

type MinimalConfirmationSnapshot = {
  supportLevelCandidate: CoursePackSupportLevel;
  concepts: MinimalConfirmationConcept[];
  extractionSnapshot?: {
    examBlueprint?: {
      areas: MinimalBlueprintArea[];
    } | null;
  } | null;
};

type MinimalFocusCompiledConcept = {
  sourceConfirmedConceptId: string;
  displayLabel: string;
};

export type CoursePackRefreshReasonType =
  | "changed_concept"
  | "changed_blueprint_priority"
  | "support_level_impact"
  | "new_material";

export type CoursePackRefreshContextPayload = {
  reasonType: CoursePackRefreshReasonType;
  sourceLabel: string | null;
  previousSupportLevel: CoursePackSupportLevel | null;
  currentSupportLevel: CoursePackSupportLevel;
};

export type CoursePackSessionRefreshHandoffPayload =
  CoursePackRefreshContextPayload & {
    isFirstSessionAfterRefresh: boolean;
    isFollowThroughSession: boolean;
  };

export function shouldContinueRefreshFollowThrough(input: {
  compiledConceptState: {
    masteryState: MasteryState;
    recentErrorTag: ProgrammingErrorTag | null;
  } | null;
  incorrectCount: number;
}) {
  if (
    input.compiledConceptState &&
    (input.compiledConceptState.masteryState !== MasteryState.steady ||
      input.compiledConceptState.recentErrorTag !== null)
  ) {
    return true;
  }

  return input.incorrectCount > 0;
}

export function deriveChangedConfirmedConceptIdsForRefresh(input: {
  currentConfirmationSnapshot: Pick<
    ConfirmationSnapshotWithRelations,
    "concepts"
  >;
  previousConfirmationSnapshot:
    | Pick<ConfirmationSnapshotWithRelations, "concepts">
    | null
    | undefined;
}) {
  if (!input.previousConfirmationSnapshot) {
    return [];
  }

  const previousConceptByIdentity = new Map(
    input.previousConfirmationSnapshot.concepts.map((concept) => [
      getConceptIdentityKey(concept),
      concept,
    ]),
  );

  return input.currentConfirmationSnapshot.concepts
    .filter((concept) => {
      const previousConcept = previousConceptByIdentity.get(
        getConceptIdentityKey(concept),
      );

      if (!previousConcept) {
        return true;
      }

      return (
        previousConcept.label !== concept.label ||
        previousConcept.sequenceOrder !== concept.sequenceOrder ||
        previousConcept.assessmentRelevance !== concept.assessmentRelevance ||
        previousConcept.isExamImportant !== concept.isExamImportant ||
        previousConcept.engineConceptId !== concept.engineConceptId ||
        !stringArraysEqual(
          previousConcept.referencedBlueprintAreaIds,
          concept.referencedBlueprintAreaIds,
        )
      );
    })
    .map((concept) => concept.id);
}

export function selectFocusCompiledConcept(
  concepts: Array<{
    id: string;
    sourceConfirmedConceptId: string;
    engineConceptId: string | null;
    isExamImportant: boolean;
    priorityTier: ExamBlueprintPriorityTier;
    suggestedTimeSharePct: number;
    sequenceOrder: number;
  }>,
  prioritizedSourceConfirmedConceptIds: string[] = [],
) {
  const prioritizedIds = new Set(prioritizedSourceConfirmedConceptIds);

  return (
    [...concepts].sort((left, right) => {
      if (
        prioritizedIds.has(left.sourceConfirmedConceptId) !==
        prioritizedIds.has(right.sourceConfirmedConceptId)
      ) {
        return prioritizedIds.has(left.sourceConfirmedConceptId) ? -1 : 1;
      }

      if (left.isExamImportant !== right.isExamImportant) {
        return left.isExamImportant ? -1 : 1;
      }

      const priorityWeightDifference =
        priorityWeight(right.priorityTier) - priorityWeight(left.priorityTier);

      if (priorityWeightDifference !== 0) {
        return priorityWeightDifference;
      }

      if (left.suggestedTimeSharePct !== right.suggestedTimeSharePct) {
        return right.suggestedTimeSharePct - left.suggestedTimeSharePct;
      }

      if (Boolean(left.engineConceptId) !== Boolean(right.engineConceptId)) {
        return left.engineConceptId ? -1 : 1;
      }

      return left.sequenceOrder - right.sequenceOrder;
    })[0] ?? null
  );
}

export function deriveCoursePackRefreshContext(input: {
  currentConfirmationSnapshot: MinimalConfirmationSnapshot;
  previousConfirmationSnapshot: MinimalConfirmationSnapshot | null | undefined;
  focusCompiledConcept?: MinimalFocusCompiledConcept | null;
}): CoursePackRefreshContextPayload | null {
  const previousSnapshot = input.previousConfirmationSnapshot;

  if (!previousSnapshot) {
    return null;
  }

  const previousSupportLevel = previousSnapshot.supportLevelCandidate;
  const currentSupportLevel = input.currentConfirmationSnapshot.supportLevelCandidate;
  const previousConceptByIdentity = new Map(
    previousSnapshot.concepts.map((concept) => [
      getConceptIdentityKey(concept),
      concept,
    ]),
  );
  const changedConceptIds = new Set(
    deriveChangedConfirmedConceptIdsForRefresh({
      currentConfirmationSnapshot: input.currentConfirmationSnapshot as never,
      previousConfirmationSnapshot: previousSnapshot as never,
    }),
  );
  const focusConcept =
    resolveFocusConcept({
      currentConfirmationSnapshot: input.currentConfirmationSnapshot,
      focusCompiledConcept: input.focusCompiledConcept ?? null,
      changedConceptIds,
    }) ?? null;

  if (previousSupportLevel !== currentSupportLevel) {
    return {
      reasonType: "support_level_impact",
      sourceLabel:
        focusConcept?.label ??
        input.focusCompiledConcept?.displayLabel ??
        null,
      previousSupportLevel,
      currentSupportLevel,
    };
  }

  if (
    focusConcept &&
    !previousConceptByIdentity.has(getConceptIdentityKey(focusConcept))
  ) {
    return {
      reasonType: "new_material",
      sourceLabel: focusConcept.label,
      previousSupportLevel,
      currentSupportLevel,
    };
  }

  const changedBlueprintAreaLabel = resolveChangedBlueprintAreaLabel({
    currentConfirmationSnapshot: input.currentConfirmationSnapshot,
    previousConfirmationSnapshot: previousSnapshot,
    focusConcept,
  });

  if (changedBlueprintAreaLabel) {
    return {
      reasonType: "changed_blueprint_priority",
      sourceLabel: changedBlueprintAreaLabel,
      previousSupportLevel,
      currentSupportLevel,
    };
  }

  if (focusConcept && changedConceptIds.has(focusConcept.id)) {
    return {
      reasonType: "changed_concept",
      sourceLabel: focusConcept.label,
      previousSupportLevel,
      currentSupportLevel,
    };
  }

  const firstNewConcept = input.currentConfirmationSnapshot.concepts.find(
    (concept) => !previousConceptByIdentity.has(getConceptIdentityKey(concept)),
  );

  if (firstNewConcept) {
    return {
      reasonType: "new_material",
      sourceLabel: firstNewConcept.label,
      previousSupportLevel,
      currentSupportLevel,
    };
  }

  const firstChangedConcept = input.currentConfirmationSnapshot.concepts.find(
    (concept) => changedConceptIds.has(concept.id),
  );

  if (!firstChangedConcept) {
    return null;
  }

  return {
    reasonType: "changed_concept",
    sourceLabel: firstChangedConcept.label,
    previousSupportLevel,
    currentSupportLevel,
  };
}

function resolveFocusConcept(input: {
  currentConfirmationSnapshot: MinimalConfirmationSnapshot;
  focusCompiledConcept: MinimalFocusCompiledConcept | null;
  changedConceptIds: Set<string>;
}) {
  if (input.focusCompiledConcept) {
    const resolvedFocusConcept = input.currentConfirmationSnapshot.concepts.find(
      (concept) =>
        concept.id === input.focusCompiledConcept?.sourceConfirmedConceptId,
    );

    if (resolvedFocusConcept) {
      return resolvedFocusConcept;
    }
  }

  return (
    input.currentConfirmationSnapshot.concepts.find((concept) =>
      input.changedConceptIds.has(concept.id),
    ) ?? null
  );
}

function resolveChangedBlueprintAreaLabel(input: {
  currentConfirmationSnapshot: MinimalConfirmationSnapshot;
  previousConfirmationSnapshot: MinimalConfirmationSnapshot;
  focusConcept: MinimalConfirmationConcept | null;
}) {
  const currentAreas = input.currentConfirmationSnapshot.extractionSnapshot?.examBlueprint?.areas ?? [];
  const previousAreas = input.previousConfirmationSnapshot.extractionSnapshot?.examBlueprint?.areas ?? [];
  const previousAreasByLabel = new Map(
    previousAreas.map((area) => [normalizeAreaLabel(area.label), area]),
  );
  const relevantAreaIds = new Set(
    input.focusConcept?.referencedBlueprintAreaIds ??
      currentAreas.map((area) => area.id),
  );

  for (const currentArea of currentAreas) {
    if (!relevantAreaIds.has(currentArea.id)) {
      continue;
    }

    const previousArea = previousAreasByLabel.get(
      normalizeAreaLabel(currentArea.label),
    );

    if (!previousArea) {
      continue;
    }

    if (
      previousArea.priorityTier !== currentArea.priorityTier ||
      previousArea.suggestedTimeSharePct !== currentArea.suggestedTimeSharePct
    ) {
      return currentArea.label;
    }
  }

  return null;
}

function normalizeAreaLabel(label: string) {
  return label.trim().toLowerCase();
}

function getConceptIdentityKey(concept: {
  engineConceptId: string | null;
  label: string;
}) {
  return concept.engineConceptId ?? concept.label.trim().toLowerCase();
}

function priorityWeight(priorityTier: ExamBlueprintPriorityTier) {
  if (priorityTier === ExamBlueprintPriorityTier.high) {
    return 3;
  }

  if (priorityTier === ExamBlueprintPriorityTier.medium) {
    return 2;
  }

  return 1;
}

function stringArraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const normalizedLeft = left.slice().sort();
  const normalizedRight = right.slice().sort();

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}
