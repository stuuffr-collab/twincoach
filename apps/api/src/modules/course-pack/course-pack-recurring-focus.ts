import {
  PackProgressMemoryPayload,
  RecurringFocusDecisionPayload,
  ResolvedRecurringFocusPayload,
} from "./course-pack.types";

function normalizeLabel(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildFocusKey(input: {
  normalizedConceptId: string | null;
  label: string;
}) {
  return input.normalizedConceptId ?? `label:${normalizeLabel(input.label)}`;
}

export function deriveRecurringFocusDecision(
  memory: PackProgressMemoryPayload | null,
  resolvedRecurring: ResolvedRecurringFocusPayload | null = null,
): RecurringFocusDecisionPayload | null {
  if (!memory) {
    return null;
  }

  const currentFocus =
    memory.recentFocusHistory.find((item) => item.status === "current") ?? null;

  if (!currentFocus) {
    return null;
  }

  const currentFocusKey = buildFocusKey(currentFocus);
  const recurringKey = memory.recurring ? buildFocusKey(memory.recurring) : null;
  const stabilizedKey = memory.recentlyStabilized
    ? buildFocusKey(memory.recentlyStabilized)
    : null;
  const resolvedRecurringKey = resolvedRecurring
    ? buildFocusKey(resolvedRecurring)
    : null;
  const recentHistoryContainsResolved =
    resolvedRecurringKey != null &&
    memory.recentFocusHistory.some(
      (item) => buildFocusKey(item) === resolvedRecurringKey,
    );

  if (
    resolvedRecurring &&
    memory.recurring &&
    recurringKey === resolvedRecurringKey &&
    currentFocusKey === resolvedRecurringKey &&
    isStrongRecurring(memory.recurring)
  ) {
    return {
      decisionType: "returning_to_resolved_area",
      currentFocusNormalizedConceptId: currentFocus.normalizedConceptId,
      currentFocusLabel: currentFocus.label,
      sourceNormalizedConceptId: resolvedRecurring.normalizedConceptId,
      sourceLabel: resolvedRecurring.label,
      repeatCount: memory.recurring.repeatCount,
      reasonCode: "genuine_resurfacing",
      nextStepIntent: "stay",
    };
  }

  if (
    resolvedRecurring &&
    resolvedRecurringKey &&
    currentFocusKey !== resolvedRecurringKey &&
    recentHistoryContainsResolved &&
    (recurringKey == null || recurringKey === resolvedRecurringKey)
  ) {
    return {
      decisionType: "holding_against_recent_residue",
      currentFocusNormalizedConceptId: currentFocus.normalizedConceptId,
      currentFocusLabel: currentFocus.label,
      sourceNormalizedConceptId: resolvedRecurring.normalizedConceptId,
      sourceLabel: resolvedRecurring.label,
      repeatCount: null,
      reasonCode: "recent_memory_residue",
      nextStepIntent: "move_on",
    };
  }

  if (memory.recurring && currentFocusKey === recurringKey) {
    const shouldEscalate = isStrongRecurring(memory.recurring);

    return {
      decisionType: shouldEscalate
        ? "escalating_recurring_area"
        : "staying_with_recurring_area",
      currentFocusNormalizedConceptId: currentFocus.normalizedConceptId,
      currentFocusLabel: currentFocus.label,
      sourceNormalizedConceptId: memory.recurring.normalizedConceptId,
      sourceLabel: memory.recurring.label,
      repeatCount: memory.recurring.repeatCount,
      reasonCode: memory.recurring.reason,
      nextStepIntent: "stay",
    };
  }

  if (memory.recurring && currentFocusKey !== recurringKey) {
    return {
      decisionType: "rotating_from_recurring_area",
      currentFocusNormalizedConceptId: currentFocus.normalizedConceptId,
      currentFocusLabel: currentFocus.label,
      sourceNormalizedConceptId: memory.recurring.normalizedConceptId,
      sourceLabel: memory.recurring.label,
      repeatCount: memory.recurring.repeatCount,
      reasonCode: memory.recurring.reason,
      nextStepIntent: "move_on",
    };
  }

  if (memory.recentlyStabilized && currentFocusKey !== stabilizedKey) {
    return {
      decisionType: "rotating_after_stabilization",
      currentFocusNormalizedConceptId: currentFocus.normalizedConceptId,
      currentFocusLabel: currentFocus.label,
      sourceNormalizedConceptId: memory.recentlyStabilized.normalizedConceptId,
      sourceLabel: memory.recentlyStabilized.label,
      repeatCount: null,
      reasonCode: "area_stabilized",
      nextStepIntent: "move_on",
    };
  }

  return null;
}

function isStrongRecurring(
  recurring: NonNullable<PackProgressMemoryPayload["recurring"]>,
) {
  return (
    recurring.reason === "recent_support_signal" || recurring.repeatCount >= 3
  );
}
