import assert from "node:assert/strict";
import test from "node:test";
import {
  getRefreshFollowThroughPresentation,
  getRefreshPresentation,
  getRefreshResolutionPresentation,
} from "../src/lib/course-pack-refresh-presentation.ts";

test("builds compact today handoff copy for newly added material", () => {
  const presentation = getRefreshPresentation("today", {
    focusLabel: "Loops",
    courseTitle: "Applied Programming",
    refreshContext: {
      reasonType: "new_material",
      sourceLabel: "Loops",
      previousSupportLevel: "guided_study",
      currentSupportLevel: "guided_study",
      firstSessionPending: true,
    },
  });

  assert.match(presentation.title, /Loops/);
  assert.equal(presentation.reasonChip, "مادة جديدة");
  assert.match(presentation.description, /Applied Programming/);
});

test("builds first-session restart copy for support-level impact", () => {
  const presentation = getRefreshPresentation("session", {
    focusLabel: "Tracing",
    courseTitle: "Applied Programming",
    refreshContext: {
      reasonType: "support_level_impact",
      sourceLabel: "Tracing",
      previousSupportLevel: "planning_review",
      currentSupportLevel: "guided_study",
      isFirstSessionAfterRefresh: true,
      isFollowThroughSession: false,
      isResolutionSession: false,
    },
  });

  assert.equal(presentation.reasonChip, "تأثير على نوع الدعم");
  assert.match(presentation.description, /Tracing/);
  assert.match(presentation.supportingText, /إعادة دخول/);
});

test("builds calm summary copy for the first session after refresh", () => {
  const presentation = getRefreshPresentation("summary", {
    focusLabel: "Functions",
    courseTitle: "Applied Programming",
    refreshContext: {
      reasonType: "changed_blueprint_priority",
      sourceLabel: "Functions practice",
      previousSupportLevel: "full_coach",
      currentSupportLevel: "full_coach",
      isFirstSessionAfterRefresh: true,
      isFollowThroughSession: false,
      isResolutionSession: false,
    },
  });

  assert.equal(presentation.reasonChip, "أولوية محدثة");
  assert.match(presentation.title, /أول جلسة بعد تحديث المقرر/);
  assert.match(presentation.supportingText, /Functions practice/);
});

test("builds today follow-through copy when one more refreshed step is needed", () => {
  const presentation = getRefreshFollowThroughPresentation("today", {
    focusLabel: "Loops",
    courseTitle: "Applied Programming",
    followThrough: {
      targetNormalizedConceptId: "compiled-loops",
      targetLabel: "Loops",
      reasonType: "new_material",
    },
  });

  assert.match(presentation.title, /Loops/);
  assert.equal(presentation.reasonChip, "متابعة قصيرة");
  assert.match(presentation.description, /Applied Programming/);
});

test("builds summary follow-through copy when the learner can move on after stabilization", () => {
  const presentation = getRefreshFollowThroughPresentation("summary", {
    focusLabel: "Tracing",
    courseTitle: "Applied Programming",
    followThrough: {
      targetNormalizedConceptId: "compiled-tracing",
      targetLabel: "Tracing",
      reasonType: "changed_concept",
    },
    willContinueAfterSession: false,
  });

  assert.equal(presentation.reasonChip, "جاهز للانتقال");
  assert.match(presentation.title, /Tracing/);
  assert.match(presentation.supportingText, /الخطوة التالية/);
});

test("builds today resolution copy when TwinCoach returns to normal momentum", () => {
  const presentation = getRefreshResolutionPresentation("today", {
    focusLabel: "Functions",
    courseTitle: "Applied Programming",
    resolution: {
      resolvedNormalizedConceptId: "compiled-loops",
      resolvedLabel: "Loops",
      reasonType: "new_material",
    },
  });

  assert.equal(presentation.reasonChip, "عودة للمسار الطبيعي");
  assert.match(presentation.title, /Loops/);
  assert.match(presentation.description, /Functions/);
});

test("builds session resolution copy for the first normal step after refresh resolution", () => {
  const presentation = getRefreshResolutionPresentation("session", {
    focusLabel: "Tracing",
    courseTitle: "Applied Programming",
    resolution: {
      resolvedNormalizedConceptId: "compiled-functions",
      resolvedLabel: "Functions",
      reasonType: "changed_blueprint_priority",
    },
  });

  assert.equal(presentation.reasonChip, "عودة مقصودة");
  assert.match(presentation.description, /Tracing/);
  assert.match(presentation.supportingText, /الإيقاع الطبيعي/);
});

test("builds summary resolution copy when refresh follow-through is complete", () => {
  const presentation = getRefreshResolutionPresentation("summary", {
    focusLabel: "Debugging",
    courseTitle: "Applied Programming",
    resolution: {
      resolvedNormalizedConceptId: "compiled-tracing",
      resolvedLabel: "Tracing",
      reasonType: "support_level_impact",
    },
  });

  assert.equal(presentation.reasonChip, "استقرار كافٍ");
  assert.match(presentation.title, /Tracing/);
  assert.match(presentation.supportingText, /Debugging/);
});
