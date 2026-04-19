import { MasteryState, ProgrammingErrorTag } from "@prisma/client";
import { PackProgressMemoryPayload } from "./course-pack.types";

type FocusRef = {
  normalizedConceptId: string | null;
  label: string;
  observedAt: Date;
};

type FocusStateSignal = {
  masteryState: MasteryState;
  recentErrorTag: ProgrammingErrorTag | null;
} | null;

type DerivePackProgressMemoryInput = {
  currentFocus: {
    normalizedConceptId: string | null;
    label: string;
  } | null;
  recentFocuses: Array<
    FocusRef & {
      refreshSequence: number | null;
    }
  >;
  recentlyStabilized: FocusRef | null;
  currentFocusState: FocusStateSignal;
};

function buildFocusKey(input: {
  normalizedConceptId: string | null;
  label: string;
}) {
  return input.normalizedConceptId ?? `label:${normalizeLabel(input.label)}`;
}

function normalizeLabel(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

export function derivePackProgressMemory(
  input: DerivePackProgressMemoryInput,
): PackProgressMemoryPayload | null {
  if (!input.currentFocus && input.recentFocuses.length === 0) {
    return null;
  }

  const occurrenceMap = new Map<string, number>();
  for (const focus of input.recentFocuses) {
    const focusKey = buildFocusKey(focus);
    occurrenceMap.set(focusKey, (occurrenceMap.get(focusKey) ?? 0) + 1);
  }

  const recentlyStabilizedKey = input.recentlyStabilized
    ? buildFocusKey(input.recentlyStabilized)
    : null;

  let recurring: PackProgressMemoryPayload["recurring"] = null;

  if (
    input.currentFocus &&
    input.currentFocus.normalizedConceptId &&
    (input.currentFocusState?.recentErrorTag != null ||
      input.currentFocusState?.masteryState === MasteryState.emerging)
  ) {
    recurring = {
      normalizedConceptId: input.currentFocus.normalizedConceptId,
      label: input.currentFocus.label,
      reason: "recent_support_signal",
      repeatCount: occurrenceMap.get(buildFocusKey(input.currentFocus)) ?? 1,
    };
  } else {
    const recurringFocus = input.recentFocuses.find((focus) => {
      const focusKey = buildFocusKey(focus);
      return (
        (occurrenceMap.get(focusKey) ?? 0) >= 2 &&
        focusKey !== recentlyStabilizedKey
      );
    });

    if (recurringFocus) {
      recurring = {
        normalizedConceptId: recurringFocus.normalizedConceptId,
        label: recurringFocus.label,
        reason: "repeat_focus",
        repeatCount: occurrenceMap.get(buildFocusKey(recurringFocus)) ?? 2,
      };
    }
  }

  const recurringKey = recurring ? buildFocusKey(recurring) : null;
  const history = [] as PackProgressMemoryPayload["recentFocusHistory"];
  const seenKeys = new Set<string>();
  const currentFocusKey = input.currentFocus
    ? buildFocusKey(input.currentFocus)
    : null;
  const currentObservedAt =
    currentFocusKey != null
      ? input.recentFocuses.find(
          (focus) => buildFocusKey(focus) === currentFocusKey,
        )?.observedAt ?? new Date()
      : null;

  if (input.currentFocus && currentObservedAt) {
    history.push({
      normalizedConceptId: input.currentFocus.normalizedConceptId,
      label: input.currentFocus.label,
      observedAt: currentObservedAt.toISOString(),
      status: "current",
      isRecurring: currentFocusKey === recurringKey,
    });
    if (currentFocusKey) {
      seenKeys.add(currentFocusKey);
    }
  }

  for (const focus of input.recentFocuses) {
    const focusKey = buildFocusKey(focus);

    if (seenKeys.has(focusKey)) {
      continue;
    }

    history.push({
      normalizedConceptId: focus.normalizedConceptId,
      label: focus.label,
      observedAt: focus.observedAt.toISOString(),
      status:
        focusKey === recentlyStabilizedKey ? "recently_resolved" : "recent",
      isRecurring: focusKey === recurringKey,
    });
    seenKeys.add(focusKey);

    if (history.length >= 4) {
      break;
    }
  }

  const currentHistoryItem = history.find((item) => item.status === "current");
  const firstNonCurrentItem =
    history.find((item) => item.status !== "current") ?? null;

  let carryForward: PackProgressMemoryPayload["carryForward"] = null;

  if (
    input.recentlyStabilized &&
    (!currentHistoryItem ||
      buildFocusKey(currentHistoryItem) !== recentlyStabilizedKey)
  ) {
    carryForward = {
      label: input.recentlyStabilized.label,
      reason: "recently_stabilized",
    };
  } else if (
    recurring &&
    (!currentHistoryItem ||
      buildFocusKey(currentHistoryItem) !== recurringKey)
  ) {
    carryForward = {
      label: recurring.label,
      reason: "recurring_area",
    };
  } else if (firstNonCurrentItem) {
    carryForward = {
      label: firstNonCurrentItem.label,
      reason: "recent_focus_chain",
    };
  }

  return {
    recentFocusHistory: history,
    recentlyStabilized: input.recentlyStabilized
      ? {
          normalizedConceptId: input.recentlyStabilized.normalizedConceptId,
          label: input.recentlyStabilized.label,
        }
      : null,
    recurring,
    carryForward,
  };
}
