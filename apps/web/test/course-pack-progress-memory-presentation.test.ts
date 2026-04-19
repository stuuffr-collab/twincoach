import assert from "node:assert/strict";
import test from "node:test";
import {
  getPackProgressHistoryItemLabel,
  getPackProgressMemoryPresentation,
} from "../src/lib/course-pack-progress-memory-presentation.ts";

const memory = {
  recentFocusHistory: [
    {
      normalizedConceptId: "compiled-functions",
      label: "Functions",
      observedAt: "2026-04-19T10:00:00.000Z",
      status: "current" as const,
      isRecurring: false,
    },
    {
      normalizedConceptId: "compiled-loops",
      label: "Loops",
      observedAt: "2026-04-18T10:00:00.000Z",
      status: "recently_resolved" as const,
      isRecurring: false,
    },
    {
      normalizedConceptId: "compiled-tracing",
      label: "Tracing",
      observedAt: "2026-04-17T10:00:00.000Z",
      status: "recent" as const,
      isRecurring: true,
    },
  ],
  recentlyStabilized: {
    normalizedConceptId: "compiled-loops",
    label: "Loops",
  },
  recurring: {
    normalizedConceptId: "compiled-tracing",
    label: "Tracing",
    reason: "repeat_focus" as const,
    repeatCount: 2,
  },
  carryForward: {
    label: "Loops",
    reason: "recently_stabilized" as const,
  },
};

test("builds calm today presentation for pack progress memory", () => {
  const presentation = getPackProgressMemoryPresentation("today", {
    courseTitle: "Applied Programming",
    currentFocusLabel: "Functions",
    memory,
  });

  assert.match(presentation.title, /نبني عليه الآن/);
  assert.match(presentation.description, /Applied Programming/);
  assert.match(presentation.carryForwardText ?? "", /Functions/);
  assert.match(presentation.stabilizedText ?? "", /Loops/);
});

test("builds workspace presentation without sounding like a dashboard", () => {
  const presentation = getPackProgressMemoryPresentation("workspace", {
    courseTitle: "Applied Programming",
    currentFocusLabel: "Functions",
    memory,
  });

  assert.match(presentation.title, /ذاكرة هذا المقرر/);
  assert.match(presentation.recurringText ?? "", /Tracing/);
});

test("labels current and recurring history items clearly", () => {
  assert.equal(getPackProgressHistoryItemLabel(memory.recentFocusHistory[0]), "الحالي الآن");
  assert.equal(getPackProgressHistoryItemLabel(memory.recentFocusHistory[1]), "استقر مؤخرًا");
  assert.equal(getPackProgressHistoryItemLabel(memory.recentFocusHistory[2]), "يتكرر مؤخرًا");
});
