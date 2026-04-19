import assert from "node:assert/strict";
import test from "node:test";
import { getRecurringFocusPresentation } from "../src/lib/course-pack-recurring-presentation.ts";

test("builds a calm today presentation when TwinCoach intentionally stays with a recurring area", () => {
  const presentation = getRecurringFocusPresentation("today", {
    courseTitle: "Applied Programming",
    decision: {
      decisionType: "staying_with_recurring_area",
      currentFocusNormalizedConceptId: "compiled-tracing",
      currentFocusLabel: "Tracing",
      sourceNormalizedConceptId: "compiled-tracing",
      sourceLabel: "Tracing",
      repeatCount: 2,
      reasonCode: "repeat_focus",
      nextStepIntent: "stay",
    },
  });

  assert.match(presentation.title, /Tracing/);
  assert.match(presentation.description, /Applied Programming/);
  assert.match(presentation.reasonChip, /يتكرر|متكرر|يعود/);
});

test("builds a session explanation when a recurring area is escalated intentionally", () => {
  const presentation = getRecurringFocusPresentation("session", {
    courseTitle: "Applied Programming",
    decision: {
      decisionType: "escalating_recurring_area",
      currentFocusNormalizedConceptId: "compiled-debugging",
      currentFocusLabel: "Debugging",
      sourceNormalizedConceptId: "compiled-debugging",
      sourceLabel: "Debugging",
      repeatCount: 3,
      reasonCode: "recent_support_signal",
      nextStepIntent: "stay",
    },
  });

  assert.match(presentation.title, /Debugging/);
  assert.match(presentation.supportingText, /ليست تكرارًا عشوائيًا|مقصود/);
});

test("builds a summary explanation when TwinCoach rotates away after stabilization", () => {
  const presentation = getRecurringFocusPresentation("summary", {
    courseTitle: "Applied Programming",
    decision: {
      decisionType: "rotating_after_stabilization",
      currentFocusNormalizedConceptId: "compiled-functions",
      currentFocusLabel: "Functions",
      sourceNormalizedConceptId: "compiled-loops",
      sourceLabel: "Loops",
      repeatCount: null,
      reasonCode: "area_stabilized",
      nextStepIntent: "move_on",
    },
  });

  assert.match(presentation.description, /Loops/);
  assert.match(presentation.supportingText, /المسار الطبيعي|ننتقل/);
});

test("builds a today explanation when TwinCoach returns to a resolved recurring area for a real new reason", () => {
  const presentation = getRecurringFocusPresentation("today", {
    courseTitle: "Applied Programming",
    decision: {
      decisionType: "returning_to_resolved_area",
      currentFocusNormalizedConceptId: "compiled-debugging",
      currentFocusLabel: "Debugging",
      sourceNormalizedConceptId: "compiled-debugging",
      sourceLabel: "Debugging",
      repeatCount: 3,
      reasonCode: "genuine_resurfacing",
      nextStepIntent: "stay",
    },
  });

  assert.match(presentation.title, /Debugging/);
  assert.match(presentation.supportingText, /ليست .*عشوائي|ليست .*ذاكرة|سبب .*واضح/);
});

test("builds a summary explanation when TwinCoach deliberately ignores recent-memory residue", () => {
  const presentation = getRecurringFocusPresentation("summary", {
    courseTitle: "Applied Programming",
    decision: {
      decisionType: "holding_against_recent_residue",
      currentFocusNormalizedConceptId: "compiled-functions",
      currentFocusLabel: "Functions",
      sourceNormalizedConceptId: "compiled-debugging",
      sourceLabel: "Debugging",
      repeatCount: null,
      reasonCode: "recent_memory_residue",
      nextStepIntent: "move_on",
    },
  });

  assert.match(presentation.description, /Functions/);
  assert.match(presentation.supportingText, /لا .*نبالغ|ليست .*فرض|لن .*نعود/);
});
