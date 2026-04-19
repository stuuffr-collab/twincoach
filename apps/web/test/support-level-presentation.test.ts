import assert from "node:assert/strict";
import test from "node:test";
import { getSupportLevelPresentation } from "../src/lib/support-level-presentation.ts";

test("today presentation changes clearly across support levels", () => {
  const fullCoach = getSupportLevelPresentation("full_coach", {
    hasActiveSession: false,
  });
  const guidedStudy = getSupportLevelPresentation("guided_study", {
    hasActiveSession: false,
  });
  const planningReview = getSupportLevelPresentation("planning_review", {
    hasActiveSession: false,
  });

  assert.equal(fullCoach.today.primaryActionLabel, "ابدأ تدريبًا عميقًا");
  assert.equal(guidedStudy.today.primaryActionLabel, "ابدأ دراسة موجهة");
  assert.equal(planningReview.today.primaryActionLabel, "ابدأ مراجعة منظمة");

  assert.notEqual(
    fullCoach.today.primaryActionSupportingText,
    guidedStudy.today.primaryActionSupportingText,
  );
  assert.notEqual(
    guidedStudy.today.primaryActionSupportingText,
    planningReview.today.primaryActionSupportingText,
  );
});

test("session framing stays honest about evaluation depth", () => {
  const fullCoach = getSupportLevelPresentation("full_coach");
  const guidedStudy = getSupportLevelPresentation("guided_study");
  const planningReview = getSupportLevelPresentation("planning_review");

  assert.match(fullCoach.session.evaluationText, /إشارة أداء فعلية/u);
  assert.match(guidedStudy.session.evaluationText, /إشارة توجيه/u);
  assert.match(planningReview.session.evaluationText, /لا تدّعي تقييمًا عميقًا/u);
});

test("summary labels and interpretation differ by support level", () => {
  const fullCoach = getSupportLevelPresentation("full_coach");
  const guidedStudy = getSupportLevelPresentation("guided_study");
  const planningReview = getSupportLevelPresentation("planning_review");

  assert.equal(fullCoach.summary.positiveLabel, "موفّق");
  assert.equal(guidedStudy.summary.positiveLabel, "أوضح الآن");
  assert.equal(planningReview.summary.reviewLabel, "عودة للخطة");

  assert.match(fullCoach.summary.interpretationText, /إشارة أداء أقوى/u);
  assert.match(guidedStudy.summary.interpretationText, /إشارة اتجاه/u);
  assert.match(planningReview.summary.interpretationText, /ترتيب العودة/u);
});
