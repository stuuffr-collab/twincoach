import assert from "node:assert/strict";
import test from "node:test";
import { MasteryState } from "@prisma/client";
import { derivePackProgressMemory } from "../src/modules/course-pack/course-pack-progress-memory";

test("derives compact focus history with current, stabilized, and recurring cues", () => {
  const memory = derivePackProgressMemory({
    currentFocus: {
      normalizedConceptId: "compiled-functions",
      label: "Functions",
    },
    recentFocuses: [
      {
        normalizedConceptId: "compiled-functions",
        label: "Functions",
        observedAt: new Date("2026-04-19T10:00:00.000Z"),
        refreshSequence: null,
      },
      {
        normalizedConceptId: "compiled-loops",
        label: "Loops",
        observedAt: new Date("2026-04-18T10:00:00.000Z"),
        refreshSequence: 2,
      },
      {
        normalizedConceptId: "compiled-tracing",
        label: "Tracing",
        observedAt: new Date("2026-04-17T10:00:00.000Z"),
        refreshSequence: null,
      },
      {
        normalizedConceptId: "compiled-tracing",
        label: "Tracing",
        observedAt: new Date("2026-04-16T10:00:00.000Z"),
        refreshSequence: null,
      },
    ],
    recentlyStabilized: {
      normalizedConceptId: "compiled-loops",
      label: "Loops",
      observedAt: new Date("2026-04-18T10:00:00.000Z"),
    },
    currentFocusState: {
      masteryState: MasteryState.steady,
      recentErrorTag: null,
    },
  });

  assert.ok(memory);
  assert.equal(memory.recentFocusHistory[0]?.status, "current");
  assert.equal(memory.recentlyStabilized?.label, "Loops");
  assert.equal(memory.recurring?.label, "Tracing");
  assert.equal(memory.carryForward?.label, "Loops");
});

test("prefers recent support signals when the current focus still looks recurring", () => {
  const memory = derivePackProgressMemory({
    currentFocus: {
      normalizedConceptId: "compiled-debugging",
      label: "Debugging",
    },
    recentFocuses: [
      {
        normalizedConceptId: "compiled-debugging",
        label: "Debugging",
        observedAt: new Date("2026-04-19T08:00:00.000Z"),
        refreshSequence: null,
      },
      {
        normalizedConceptId: "compiled-functions",
        label: "Functions",
        observedAt: new Date("2026-04-18T08:00:00.000Z"),
        refreshSequence: null,
      },
    ],
    recentlyStabilized: null,
    currentFocusState: {
      masteryState: MasteryState.emerging,
      recentErrorTag: "debugging_strategy_error",
    },
  });

  assert.ok(memory);
  assert.equal(memory.recurring?.label, "Debugging");
  assert.equal(memory.recurring?.reason, "recent_support_signal");
  assert.equal(memory.recentFocusHistory[0]?.isRecurring, true);
  assert.equal(memory.carryForward?.label, "Functions");
});
