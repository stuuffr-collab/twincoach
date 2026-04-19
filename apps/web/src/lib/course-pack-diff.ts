import type {
  CoursePackConfirmation,
  CoursePackExtraction,
  CoursePackRecord,
  CoursePackSupportLevel,
} from "@/src/lib/api";

export type CoursePackReviewStatus =
  | "current"
  | "refresh_extraction"
  | "review_required"
  | "refresh_activation";

export type CoursePackChangeItem = {
  id: string;
  sourceId: string;
  label: string;
  detail: string;
};

export type CoursePackChangedItem = {
  id: string;
  sourceId: string;
  label: string;
  before: string;
  after: string;
};

export type CoursePackReviewDiff = {
  documentChanges: {
    added: boolean;
    removed: boolean;
    replaced: boolean;
    roleChanged: boolean;
  };
  extractionChangedMaterially: boolean;
  reviewStatus: CoursePackReviewStatus;
  reviewStatusLabel: string;
  reviewStatusText: string;
  changedUnits: {
    added: CoursePackChangeItem[];
    removed: CoursePackChangeItem[];
    changed: CoursePackChangedItem[];
  };
  changedConcepts: {
    added: CoursePackChangeItem[];
    removed: CoursePackChangeItem[];
    changed: CoursePackChangedItem[];
  };
  changedBlueprintAreas: {
    added: CoursePackChangeItem[];
    removed: CoursePackChangeItem[];
    changed: CoursePackChangedItem[];
  };
  supportLevelImpact: {
    before: CoursePackSupportLevel;
    after: CoursePackSupportLevel;
  } | null;
  changedItemsCount: number;
  hasDiff: boolean;
};

export type CoursePackRereviewQueueItem = {
  id: string;
  sourceId: string;
  label: string;
  detail: string;
  kind: "unit" | "concept" | "blueprint" | "support_level" | "activation";
  status:
    | "needs_quick_review"
    | "needs_explicit_confirmation"
    | "needs_activation_refresh"
    | "reviewed";
  priority: number;
};

export type CoursePackRereviewQueue = {
  items: CoursePackRereviewQueueItem[];
  reviewableCount: number;
  remainingReviewCount: number;
  reviewedCount: number;
  activationRefreshRequired: boolean;
};

export function buildCoursePackReviewDiff(input: {
  coursePack: CoursePackRecord | null;
  extraction: CoursePackExtraction | null;
  confirmation: CoursePackConfirmation | null;
}): CoursePackReviewDiff {
  const documentChanges = {
    added: input.coursePack?.driftReasonCodes.includes("documents_added") ?? false,
    removed:
      input.coursePack?.driftReasonCodes.includes("documents_removed") ?? false,
    replaced:
      input.coursePack?.driftReasonCodes.includes("documents_replaced") ?? false,
    roleChanged:
      input.coursePack?.driftReasonCodes.includes("document_roles_changed") ?? false,
  };

  const changedUnits = buildUnitDiff(input.confirmation, input.extraction);
  const changedConcepts = buildConceptDiff(input.confirmation, input.extraction);
  const changedBlueprintAreas = buildBlueprintDiff(
    input.confirmation,
    input.extraction,
  );
  const supportLevelImpact = buildSupportLevelImpact(
    input.confirmation,
    input.extraction,
  );

  const extractionChangedMaterially =
    input.coursePack?.driftReasonCodes.some((reasonCode) =>
      [
        "course_graph_changed",
        "exam_blueprint_changed",
        "support_level_changed",
      ].includes(reasonCode),
    ) === true ||
    supportLevelImpact !== null ||
    countDiffItems(changedUnits) > 0 ||
    countDiffItems(changedConcepts) > 0 ||
    countDiffItems(changedBlueprintAreas) > 0;

  const reviewStatus = resolveReviewStatus(input.coursePack, input.confirmation, input.extraction);
  const reviewStatusLabel = formatReviewStatus(reviewStatus);
  const reviewStatusText = describeReviewStatus(reviewStatus);
  const changedItemsCount =
    countDiffItems(changedUnits) +
    countDiffItems(changedConcepts) +
    countDiffItems(changedBlueprintAreas) +
    (supportLevelImpact ? 1 : 0);

  return {
    documentChanges,
    extractionChangedMaterially,
    reviewStatus,
    reviewStatusLabel,
    reviewStatusText,
    changedUnits,
    changedConcepts,
    changedBlueprintAreas,
    supportLevelImpact,
    changedItemsCount,
    hasDiff:
      documentChanges.added ||
      documentChanges.removed ||
      documentChanges.replaced ||
      documentChanges.roleChanged ||
      changedItemsCount > 0 ||
      reviewStatus !== "current",
  };
}

export function buildCoursePackRereviewQueue(input: {
  reviewDiff: CoursePackReviewDiff;
  confirmation: CoursePackConfirmation | null;
  extraction: CoursePackExtraction | null;
  reviewedItemIds?: string[];
}): CoursePackRereviewQueue {
  const reviewedItemIds = new Set(input.reviewedItemIds ?? []);
  const queueItems: CoursePackRereviewQueueItem[] = [];
  const baselineConceptBySourceId = new Map(
    (input.confirmation?.concepts ?? []).map((concept) => [
      concept.sourceConceptCandidateId,
      concept,
    ]),
  );
  const currentConceptBySourceId = new Map(
    (input.extraction?.courseGraph?.concepts ?? []).map((concept) => [
      concept.sourceConceptCandidateId,
      concept,
    ]),
  );

  for (const item of input.reviewDiff.changedUnits.added) {
    queueItems.push(
      buildQueueItem({
        item,
        kind: "unit",
        priority: 88,
        defaultStatus: "needs_quick_review",
        reviewedItemIds,
        detail: "ظهرت وحدة جديدة في الخريطة. يكفي أن تتأكد أن اسمها ومكانها يعكسان المقرر الحالي.",
      }),
    );
  }

  for (const item of input.reviewDiff.changedUnits.changed) {
    queueItems.push(
      buildQueueItem({
        item,
        kind: "unit",
        priority: 84,
        defaultStatus: "needs_quick_review",
        reviewedItemIds,
        detail: item.after,
      }),
    );
  }

  for (const item of input.reviewDiff.changedUnits.removed) {
    queueItems.push(
      buildQueueItem({
        item,
        kind: "unit",
        priority: 82,
        defaultStatus: "needs_explicit_confirmation",
        reviewedItemIds,
        detail: "هذه الوحدة لم تعد ظاهرة في النسخة الجديدة. أكّد فقط إن كان حذفها يعكس موادك الحالية فعلًا.",
      }),
    );
  }

  for (const item of input.reviewDiff.changedConcepts.added) {
    const currentConcept = currentConceptBySourceId.get(item.sourceId);
    queueItems.push(
      buildQueueItem({
        item,
        kind: "concept",
        priority:
          currentConcept?.assessmentRelevance === "high" ? 96 : 86,
        defaultStatus:
          currentConcept?.assessmentRelevance === "high"
            ? "needs_explicit_confirmation"
            : "needs_quick_review",
        reviewedItemIds,
        detail:
          currentConcept?.assessmentRelevance === "high"
            ? "ظهر مفهوم جديد قد يؤثر على تركيزك القادم، لذلك نحتاج منك تثبيت وجوده ضمن المراجعة."
            : item.detail,
      }),
    );
  }

  for (const item of input.reviewDiff.changedConcepts.changed) {
    const baselineConcept = baselineConceptBySourceId.get(item.sourceId);
    const needsExplicitConfirmation =
      baselineConcept?.isExamImportant === true ||
      (baselineConcept?.referencedBlueprintAreaIds.length ?? 0) > 0;

    queueItems.push(
      buildQueueItem({
        item,
        kind: "concept",
        priority: needsExplicitConfirmation ? 94 : 83,
        defaultStatus: needsExplicitConfirmation
          ? "needs_explicit_confirmation"
          : "needs_quick_review",
        reviewedItemIds,
        detail: item.after,
      }),
    );
  }

  for (const item of input.reviewDiff.changedConcepts.removed) {
    const baselineConcept = baselineConceptBySourceId.get(item.sourceId);
    const affectsFocus =
      baselineConcept?.isExamImportant === true ||
      (baselineConcept?.referencedBlueprintAreaIds.length ?? 0) > 0;

    queueItems.push(
      buildQueueItem({
        item,
        kind: "concept",
        priority: affectsFocus ? 97 : 81,
        defaultStatus: affectsFocus
          ? "needs_explicit_confirmation"
          : "needs_quick_review",
        reviewedItemIds,
        detail: affectsFocus
          ? "هذا المفهوم كان يدخل في التركيز السابق، لذا يلزم تأكيد صريح إذا لم يعد جزءًا من النسخة الحالية."
          : item.detail,
      }),
    );
  }

  for (const item of input.reviewDiff.changedBlueprintAreas.added) {
    queueItems.push(
      buildQueueItem({
        item,
        kind: "blueprint",
        priority: 93,
        defaultStatus: "needs_explicit_confirmation",
        reviewedItemIds,
        detail: "ظهرت منطقة تركيز جديدة. راجعها أولًا لأنها قد تغيّر اتجاه المراجعة القادم.",
      }),
    );
  }

  for (const item of input.reviewDiff.changedBlueprintAreas.changed) {
    queueItems.push(
      buildQueueItem({
        item,
        kind: "blueprint",
        priority: 91,
        defaultStatus: "needs_explicit_confirmation",
        reviewedItemIds,
        detail: item.after,
      }),
    );
  }

  for (const item of input.reviewDiff.changedBlueprintAreas.removed) {
    queueItems.push(
      buildQueueItem({
        item,
        kind: "blueprint",
        priority: 90,
        defaultStatus: "needs_explicit_confirmation",
        reviewedItemIds,
        detail: "منطقة التركيز هذه لم تعد ضمن النسخة الجديدة، لذا نحتاج تأكيدًا سريعًا قبل اعتماد الخطة التالية.",
      }),
    );
  }

  if (input.reviewDiff.supportLevelImpact) {
    const supportLevelItemId = "support-level-impact";
    queueItems.push({
      id: supportLevelItemId,
      sourceId: supportLevelItemId,
      label: "تغيّر مستوى الدعم",
      detail: `كان ${input.reviewDiff.supportLevelImpact.before} وأصبح ${input.reviewDiff.supportLevelImpact.after}. راجع ما يعنيه ذلك قبل الحفظ.`,
      kind: "support_level",
      status: reviewedItemIds.has(supportLevelItemId)
        ? "reviewed"
        : "needs_explicit_confirmation",
      priority: 100,
    });
  }

  if (input.reviewDiff.reviewStatus === "refresh_activation") {
    queueItems.push({
      id: "activation-refresh",
      sourceId: "activation-refresh",
      label: "حدّث التفعيل بعد المراجعة",
      detail:
        "المراجعة الحالية ما زالت صالحة، لكن TwinCoach يحتاج تحديث التفعيل ليبني خطوة اليوم التالية على النسخة الأحدث.",
      kind: "activation",
      status: "needs_activation_refresh",
      priority: 10,
    });
  }

  const sortedItems = queueItems.slice().sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }

    return left.label.localeCompare(right.label, "ar");
  });

  const reviewableCount = sortedItems.filter(
    (item) => item.status !== "needs_activation_refresh",
  ).length;
  const reviewedCount = sortedItems.filter(
    (item) => item.status === "reviewed",
  ).length;
  const remainingReviewCount = sortedItems.filter(
    (item) =>
      item.status === "needs_quick_review" ||
      item.status === "needs_explicit_confirmation",
  ).length;

  return {
    items: sortedItems,
    reviewableCount,
    remainingReviewCount,
    reviewedCount,
    activationRefreshRequired: sortedItems.some(
      (item) => item.status === "needs_activation_refresh",
    ),
  };
}

function buildUnitDiff(
  confirmation: CoursePackConfirmation | null,
  extraction: CoursePackExtraction | null,
) {
  const baselineUnits = new Map(
    (confirmation?.units ?? []).map((unit) => [
      unit.sourceUnitCandidateId,
      {
        label: unit.label,
        sequenceOrder: unit.sequenceOrder,
        importanceTier: unit.importanceTier,
      },
    ]),
  );
  const currentUnits = new Map(
    (extraction?.courseGraph?.units ?? []).map((unit) => [
      unit.sourceUnitCandidateId,
      {
        label: unit.label,
        sequenceOrder: unit.sequenceOrder,
        importanceTier: unit.importanceTier,
      },
    ]),
  );

  return buildGenericDiff({
    baselineItems: baselineUnits,
    currentItems: currentUnits,
    idPrefix: "unit",
    formatChange: (before, after) =>
      describePairChange({
        label: "اسم الوحدة",
        before: before.label,
        after: after.label,
        fallbackLabel: "ترتيب أو أهمية الوحدة",
        fallbackBefore: `${before.sequenceOrder} • ${before.importanceTier}`,
        fallbackAfter: `${after.sequenceOrder} • ${after.importanceTier}`,
      }),
  });
}

function buildConceptDiff(
  confirmation: CoursePackConfirmation | null,
  extraction: CoursePackExtraction | null,
) {
  const currentUnitLabels = new Map(
    (extraction?.courseGraph?.units ?? []).map((unit) => [unit.graphUnitId, unit.label]),
  );
  const baselineConcepts = new Map(
    (confirmation?.concepts ?? []).map((concept) => [
      concept.sourceConceptCandidateId,
      {
        label: concept.label,
        sequenceOrder: concept.sequenceOrder,
        assessmentRelevance: concept.assessmentRelevance,
        coachabilityStatus: concept.coachabilityStatus,
      },
    ]),
  );
  const currentConcepts = new Map(
    (extraction?.courseGraph?.concepts ?? []).map((concept) => [
      concept.sourceConceptCandidateId,
      {
        label: concept.label,
        sequenceOrder: concept.sequenceOrder,
        assessmentRelevance: concept.assessmentRelevance,
        coachabilityStatus: concept.coachabilityStatus,
        unitLabel: concept.unitId ? currentUnitLabels.get(concept.unitId) ?? "" : "",
      },
    ]),
  );

  return buildGenericDiff({
    baselineItems: baselineConcepts,
    currentItems: currentConcepts,
    idPrefix: "concept",
    formatChange: (before, after) =>
      describePairChange({
        label: "اسم المفهوم",
        before: before.label,
        after: after.label,
        fallbackLabel: "دور المفهوم أو ترتيبه",
        fallbackBefore: `${before.sequenceOrder} • ${before.assessmentRelevance} • ${before.coachabilityStatus}`,
        fallbackAfter: `${after.sequenceOrder} • ${after.assessmentRelevance} • ${after.coachabilityStatus}`,
      }),
  });
}

function buildBlueprintDiff(
  confirmation: CoursePackConfirmation | null,
  extraction: CoursePackExtraction | null,
) {
  const baselineAreas = new Map(
    (confirmation?.baselineBlueprintAreas ?? []).map((area) => [
      normalizeLabel(area.label),
      {
        label: area.label,
        priorityTier: area.priorityTier,
        practiceNeed: area.practiceNeed,
        recurrenceSignal: area.recurrenceSignal,
        suggestedTimeSharePct: area.suggestedTimeSharePct,
      },
    ]),
  );
  const currentAreas = new Map(
    (extraction?.examBlueprint?.areas ?? []).map((area) => [
      normalizeLabel(area.label),
      {
        label: area.label,
        priorityTier: area.priorityTier,
        practiceNeed: area.practiceNeed,
        recurrenceSignal: area.recurrenceSignal,
        suggestedTimeSharePct: area.suggestedTimeSharePct,
      },
    ]),
  );

  return buildGenericDiff({
    baselineItems: baselineAreas,
    currentItems: currentAreas,
    idPrefix: "blueprint",
    formatChange: (before, after) =>
      describePairChange({
        label: "منطقة التركيز",
        before: `${before.label} • ${before.priorityTier} • ${before.suggestedTimeSharePct}%`,
        after: `${after.label} • ${after.priorityTier} • ${after.suggestedTimeSharePct}%`,
        fallbackLabel: "درجة التركيز أو نوع المراجعة",
        fallbackBefore: `${before.practiceNeed} • ${before.recurrenceSignal}`,
        fallbackAfter: `${after.practiceNeed} • ${after.recurrenceSignal}`,
      }),
  });
}

function buildSupportLevelImpact(
  confirmation: CoursePackConfirmation | null,
  extraction: CoursePackExtraction | null,
) {
  const before = confirmation?.supportLevelCandidate;
  const after = extraction?.supportLevelAssessment?.candidateSupportLevel;

  if (!before || !after || before === after) {
    return null;
  }

  return {
    before,
    after,
  };
}

function resolveReviewStatus(
  coursePack: CoursePackRecord | null,
  confirmation: CoursePackConfirmation | null,
  extraction: CoursePackExtraction | null,
): CoursePackReviewStatus {
  if (coursePack?.driftStatus === "pending_refresh") {
    return "refresh_extraction";
  }

  if (coursePack?.requiresReconfirmation || coursePack?.driftStatus === "review_required") {
    return "review_required";
  }

  if (coursePack?.activeContextState === "stale") {
    return "refresh_activation";
  }

  if (
    confirmation &&
    extraction &&
    confirmation.extractionSnapshotId !== extraction.extractionSnapshotId
  ) {
    return "review_required";
  }

  return "current";
}

function formatReviewStatus(reviewStatus: CoursePackReviewStatus) {
  switch (reviewStatus) {
    case "refresh_extraction":
      return "يلزم تحديث الخريطة أولًا";
    case "review_required":
      return "يلزم إعادة المراجعة";
    case "refresh_activation":
      return "يلزم تحديث التفعيل";
    default:
      return "المراجعة الحالية ما زالت صالحة";
  }
}

function describeReviewStatus(reviewStatus: CoursePackReviewStatus) {
  switch (reviewStatus) {
    case "refresh_extraction":
      return "حدثت تغييرات على الملفات، لكن TwinCoach ما زال ينتظر Extraction جديدًا قبل أن يبيّن لك ما الذي تغير فعلًا.";
    case "review_required":
      return "التغييرات الجديدة أثرت على الخريطة أو التركيز بما يكفي لتحتاج مراجعة سريعة قبل أن نعتمد النسخة الحالية.";
    case "refresh_activation":
      return "راجعت النسخة الأحدث بالفعل، لكن سياقك النشط ما زال يشير إلى نسخة أقدم حتى تحدّث التفعيل.";
    default:
      return "لا يوجد ما يفرض إعادة مراجعة الآن. يمكنك متابعة العمل على النسخة الحالية بثقة.";
  }
}

function buildGenericDiff<T extends { label: string }>(input: {
  baselineItems: Map<string, T>;
  currentItems: Map<string, T>;
  idPrefix: string;
  formatChange: (before: T, after: T) => string;
}) {
  const added: CoursePackChangeItem[] = [];
  const removed: CoursePackChangeItem[] = [];
  const changed: CoursePackChangedItem[] = [];

  for (const [id, item] of input.currentItems) {
    const baseline = input.baselineItems.get(id);

    if (!baseline) {
      added.push({
        id: `${input.idPrefix}-added-${id}`,
        sourceId: id,
        label: item.label,
        detail: "عنصر جديد لم يكن موجودًا في آخر نسخة مؤكدة.",
      });
      continue;
    }

    if (!itemsEquivalent(baseline, item)) {
      changed.push({
        id: `${input.idPrefix}-changed-${id}`,
        sourceId: id,
        label: item.label,
        before: baseline.label,
        after: input.formatChange(baseline, item),
      });
    }
  }

  for (const [id, item] of input.baselineItems) {
    if (!input.currentItems.has(id)) {
      removed.push({
        id: `${input.idPrefix}-removed-${id}`,
        sourceId: id,
        label: item.label,
        detail: "كان موجودًا في آخر نسخة مؤكدة، ولم يعد ظاهرًا في النسخة المستخرجة الحالية.",
      });
    }
  }

  return {
    added,
    removed,
    changed,
  };
}

function itemsEquivalent(left: Record<string, unknown>, right: Record<string, unknown>) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildQueueItem(input: {
  item: CoursePackChangeItem | CoursePackChangedItem;
  kind: CoursePackRereviewQueueItem["kind"];
  priority: number;
  defaultStatus:
    | "needs_quick_review"
    | "needs_explicit_confirmation"
    | "needs_activation_refresh";
  reviewedItemIds: Set<string>;
  detail: string;
}) {
  return {
    id: input.item.id,
    sourceId: input.item.sourceId,
    label: input.item.label,
    detail: input.detail,
    kind: input.kind,
    status: input.reviewedItemIds.has(input.item.id)
      ? "reviewed"
      : input.defaultStatus,
    priority: input.priority,
  } satisfies CoursePackRereviewQueueItem;
}

function countDiffItems(input: {
  added: CoursePackChangeItem[];
  removed: CoursePackChangeItem[];
  changed: CoursePackChangedItem[];
}) {
  return input.added.length + input.removed.length + input.changed.length;
}

function describePairChange(input: {
  label: string;
  before: string;
  after: string;
  fallbackLabel: string;
  fallbackBefore: string;
  fallbackAfter: string;
}) {
  if (normalizeLabel(input.before) !== normalizeLabel(input.after)) {
    return `${input.label}: ${input.before} ← سابقًا، والآن ${input.after}`;
  }

  return `${input.fallbackLabel}: ${input.fallbackBefore} ← سابقًا، والآن ${input.fallbackAfter}`;
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
