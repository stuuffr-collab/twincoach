import assert from "node:assert/strict";

process.loadEnvFile?.(".env");

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
const adminKey = process.env.ALPHA_OPERATOR_KEY ?? "";

const diagnosticAnswers = {
  diag_q01: "11",
  diag_q02: "5",
  diag_q03: "x > 4",
  diag_q04: "y = 2x + 1",
  diag_q05: "11",
  diag_q06: "y = 2x + 3",
};

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

async function run() {
  assert.ok(adminKey, "ALPHA_OPERATOR_KEY is required for alpha verification");

  const adminHeaders = {
    "x-admin-key": adminKey,
  };

  const onboarding = await request("/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      examDate: "2026-06-20",
      activeUnitId: "ca_u03_linear_equations",
    }),
  });
  assert.equal(onboarding.status, 201);

  const learnerId = onboarding.data.learnerId;
  const learnerHeaders = { "x-learner-id": learnerId };

  const todayBeforeDiagnostic = await request("/today", {
    headers: learnerHeaders,
  });
  assert.equal(todayBeforeDiagnostic.status, 400);
  assert.equal(todayBeforeDiagnostic.data.message, "Diagnostic incomplete");

  let diagnostic = await request("/diagnostic/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(diagnostic.status, 201);

  while (diagnostic.data.status !== "completed") {
    const questionItemId = diagnostic.data.currentItem.questionItemId;
    const isLastItem = diagnostic.data.currentIndex === diagnostic.data.totalItems;

    const submit = await request(`/session/${diagnostic.data.sessionId}/answer`, {
      method: "POST",
      headers: {
        ...learnerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionItemId: diagnostic.data.currentItem.sessionItemId,
        answerValue: isLastItem
          ? "wrong-answer"
          : diagnosticAnswers[questionItemId],
        checkpointToken: diagnostic.data.checkpointToken,
      }),
    });
    assert.equal(submit.status, 201);

    if (submit.data.sessionStatus === "completed") {
      break;
    }

    diagnostic = await request(`/session/${diagnostic.data.sessionId}`, {
      headers: learnerHeaders,
    });
    assert.equal(diagnostic.status, 200);
  }

  const todayAfterDiagnostic = await request("/today", {
    headers: learnerHeaders,
  });
  assert.equal(todayAfterDiagnostic.status, 200);
  assert.equal(todayAfterDiagnostic.data.readinessBand, "Insufficient Evidence");

  const adminWithoutKey = await request(`/admin/learner/${learnerId}`);
  assert.equal(adminWithoutKey.status, 401);

  const recentLearners = await request("/admin/learners/recent", {
    headers: adminHeaders,
  });
  assert.equal(recentLearners.status, 200);
  assert.ok(
    recentLearners.data.some((item) => item.learnerId === learnerId),
  );

  const learnerLookup = await request(`/admin/learner/${learnerId}`, {
    headers: adminHeaders,
  });
  assert.equal(learnerLookup.status, 200);
  assert.equal(learnerLookup.data.learnerId, learnerId);
  assert.ok(Array.isArray(learnerLookup.data.topicStates));
  assert.ok(Array.isArray(learnerLookup.data.recentAttempts));

  const now = Date.now();
  const dueTopicIds = new Set(
    learnerLookup.data.topicStates
      .filter(
        (topicState) =>
          topicState.nextReviewDueAt &&
          Date.parse(topicState.nextReviewDueAt) <= now,
      )
      .map((topicState) => topicState.topicId),
  );
  assert.ok(dueTopicIds.size > 0);

  const daily = await request("/session/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(daily.status, 201);

  const preview = await request(
    `/admin/session/${daily.data.sessionId}/preview`,
    {
      headers: adminHeaders,
    },
  );
  assert.equal(preview.status, 200);
  assert.equal(preview.data.totalItems, 3);

  const reviewItem = preview.data.items.find((item) => item.slotType === "review");
  assert.ok(reviewItem);
  assert.ok(dueTopicIds.has(reviewItem.topicId));

  const deactivate = await request(
    `/admin/item/${reviewItem.questionItemId}/deactivate`,
    {
      method: "POST",
      headers: adminHeaders,
    },
  );
  assert.equal(deactivate.status, 201);
  assert.equal(deactivate.data.isActive, false);

  let dailySession = await request(`/session/${daily.data.sessionId}`, {
    headers: learnerHeaders,
  });
  assert.equal(dailySession.status, 200);

  while (dailySession.data.status !== "completed") {
    const questionItemId = dailySession.data.currentItem.questionItemId;
    const submit = await request(`/session/${daily.data.sessionId}/answer`, {
      method: "POST",
      headers: {
        ...learnerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionItemId: dailySession.data.currentItem.sessionItemId,
        answerValue: diagnosticAnswers[questionItemId] ?? "wrong-answer",
        checkpointToken: dailySession.data.checkpointToken,
      }),
    });
    assert.equal(submit.status, 201);

    if (submit.data.sessionStatus === "completed") {
      break;
    }

    dailySession = await request(`/session/${daily.data.sessionId}`, {
      headers: learnerHeaders,
    });
    assert.equal(dailySession.status, 200);
  }

  const nextDaily = await request("/session/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(nextDaily.status, 201);

  const nextPreview = await request(
    `/admin/session/${nextDaily.data.sessionId}/preview`,
    {
      headers: adminHeaders,
    },
  );
  assert.equal(nextPreview.status, 200);
  assert.ok(
    nextPreview.data.items.every(
      (item) => item.questionItemId !== reviewItem.questionItemId,
    ),
  );

  console.log("Alpha readiness verification passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
