import assert from "node:assert/strict";
import test from "node:test";
import { deriveRecurringFocusDecision } from "../src/modules/course-pack/course-pack-recurring-focus";

test("keeps a recurring area active when it is repeating without stronger escalation", () => {
  const decision = deriveRecurringFocusDecision({
    recentFocusHistory: [
      {
        normalizedConceptId: "compiled-tracing",
        label: "Tracing",
        observedAt: "2026-04-19T10:00:00.000Z",
        status: "current",
        isRecurring: true,
      },
      {
        normalizedConceptId: "compiled-loops",
        label: "Loops",
        observedAt: "2026-04-18T10:00:00.000Z",
        status: "recent",
        isRecurring: false,
      },
    ],
    recentlyStabilized: null,
    recurring: {
      normalizedConceptId: "compiled-tracing",
      label: "Tracing",
      reason: "repeat_focus",
      repeatCount: 2,
    },
    carryForward: {
      label: "Loops",
      reason: "recent_focus_chain",
    },
  });

  assert.ok(decision);
  assert.equal(decision.decisionType, "staying_with_recurring_area");
  assert.equal(decision.currentFocusLabel, "Tracing");
  assert.equal(decision.sourceLabel, "Tracing");
  assert.equal(decision.nextStepIntent, "stay");
});

test("escalates a recurring area when support signals or repeat depth are stronger", () => {
  const decision = deriveRecurringFocusDecision({
    recentFocusHistory: [
      {
        normalizedConceptId: "compiled-debugging",
        label: "Debugging",
        observedAt: "2026-04-19T10:00:00.000Z",
        status: "current",
        isRecurring: true,
      },
      {
        normalizedConceptId: "compiled-debugging",
        label: "Debugging",
        observedAt: "2026-04-18T10:00:00.000Z",
        status: "recent",
        isRecurring: true,
      },
    ],
    recentlyStabilized: null,
    recurring: {
      normalizedConceptId: "compiled-debugging",
      label: "Debugging",
      reason: "recent_support_signal",
      repeatCount: 3,
    },
    carryForward: null,
  });

  assert.ok(decision);
  assert.equal(decision.decisionType, "escalating_recurring_area");
  assert.equal(decision.sourceLabel, "Debugging");
  assert.equal(decision.repeatCount, 3);
});

test("rotates away once a recurring area is no longer driving the current focus", () => {
  const decision = deriveRecurringFocusDecision({
    recentFocusHistory: [
      {
        normalizedConceptId: "compiled-functions",
        label: "Functions",
        observedAt: "2026-04-19T10:00:00.000Z",
        status: "current",
        isRecurring: false,
      },
      {
        normalizedConceptId: "compiled-tracing",
        label: "Tracing",
        observedAt: "2026-04-18T10:00:00.000Z",
        status: "recent",
        isRecurring: true,
      },
    ],
    recentlyStabilized: null,
    recurring: {
      normalizedConceptId: "compiled-tracing",
      label: "Tracing",
      reason: "repeat_focus",
      repeatCount: 2,
    },
    carryForward: {
      label: "Tracing",
      reason: "recurring_area",
    },
  });

  assert.ok(decision);
  assert.equal(decision.decisionType, "rotating_from_recurring_area");
  assert.equal(decision.currentFocusLabel, "Functions");
  assert.equal(decision.sourceLabel, "Tracing");
  assert.equal(decision.nextStepIntent, "move_on");
});

test("treats a recently stabilized area as safe to move beyond", () => {
  const decision = deriveRecurringFocusDecision({
    recentFocusHistory: [
      {
        normalizedConceptId: "compiled-functions",
        label: "Functions",
        observedAt: "2026-04-19T10:00:00.000Z",
        status: "current",
        isRecurring: false,
      },
      {
        normalizedConceptId: "compiled-loops",
        label: "Loops",
        observedAt: "2026-04-18T10:00:00.000Z",
        status: "recently_resolved",
        isRecurring: false,
      },
    ],
    recentlyStabilized: {
      normalizedConceptId: "compiled-loops",
      label: "Loops",
    },
    recurring: null,
    carryForward: {
      label: "Loops",
      reason: "recently_stabilized",
    },
  });

  assert.ok(decision);
  assert.equal(decision.decisionType, "rotating_after_stabilization");
  assert.equal(decision.sourceLabel, "Loops");
  assert.equal(decision.currentFocusLabel, "Functions");
});

test("treats a later return to a resolved recurring area as genuine resurfacing when new support signals appear", () => {
  const decision = deriveRecurringFocusDecision(
    {
      recentFocusHistory: [
        {
          normalizedConceptId: "compiled-debugging",
          label: "Debugging",
          observedAt: "2026-04-19T10:00:00.000Z",
          status: "current",
          isRecurring: true,
        },
        {
          normalizedConceptId: "compiled-functions",
          label: "Functions",
          observedAt: "2026-04-18T10:00:00.000Z",
          status: "recent",
          isRecurring: false,
        },
        {
          normalizedConceptId: "compiled-debugging",
          label: "Debugging",
          observedAt: "2026-04-16T10:00:00.000Z",
          status: "recently_resolved",
          isRecurring: true,
        },
      ],
      recentlyStabilized: null,
      recurring: {
        normalizedConceptId: "compiled-debugging",
        label: "Debugging",
        reason: "recent_support_signal",
        repeatCount: 3,
      },
      carryForward: {
        label: "Debugging",
        reason: "recurring_area",
      },
    },
    {
      normalizedConceptId: "compiled-debugging",
      label: "Debugging",
      resolvedAt: "2026-04-17T10:00:00.000Z",
    },
  );

  assert.ok(decision);
  assert.equal(decision.decisionType, "returning_to_resolved_area");
  assert.equal(decision.currentFocusLabel, "Debugging");
  assert.equal(decision.sourceLabel, "Debugging");
  assert.equal(decision.reasonCode, "genuine_resurfacing");
  assert.equal(decision.nextStepIntent, "stay");
});

test("holds against recent-memory residue when a resolved recurring area is still recent but no longer deserves pullback", () => {
  const decision = deriveRecurringFocusDecision(
    {
      recentFocusHistory: [
        {
          normalizedConceptId: "compiled-functions",
          label: "Functions",
          observedAt: "2026-04-19T10:00:00.000Z",
          status: "current",
          isRecurring: false,
        },
        {
          normalizedConceptId: "compiled-debugging",
          label: "Debugging",
          observedAt: "2026-04-18T10:00:00.000Z",
          status: "recently_resolved",
          isRecurring: false,
        },
      ],
      recentlyStabilized: null,
      recurring: {
        normalizedConceptId: "compiled-debugging",
        label: "Debugging",
        reason: "repeat_focus",
        repeatCount: 2,
      },
      carryForward: {
        label: "Debugging",
        reason: "recurring_area",
      },
    },
    {
      normalizedConceptId: "compiled-debugging",
      label: "Debugging",
      resolvedAt: "2026-04-17T10:00:00.000Z",
    },
  );

  assert.ok(decision);
  assert.equal(decision.decisionType, "holding_against_recent_residue");
  assert.equal(decision.currentFocusLabel, "Functions");
  assert.equal(decision.sourceLabel, "Debugging");
  assert.equal(decision.reasonCode, "recent_memory_residue");
  assert.equal(decision.nextStepIntent, "move_on");
});
