import assert from "node:assert/strict";

process.loadEnvFile?.(".env");

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";

const diagnosticAnswers = {
  diag_q01: "11",
  diag_q02: "5",
  diag_q03: "x > 4",
  diag_q04: "y = 2x + 1",
  diag_q05: "11",
  diag_q06: "y = 2x + 3",
};

const dailyAnswers = {
  diag_q01: "11",
  diag_q02: "5",
  diag_q03: "x > 4",
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

  const diagnosticStart = await request("/diagnostic/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(diagnosticStart.status, 201);

  const diagnosticResume = await request("/diagnostic/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(diagnosticResume.status, 201);
  assert.equal(diagnosticResume.data.sessionId, diagnosticStart.data.sessionId);

  const staleDiagnostic = await request(
    `/session/${diagnosticStart.data.sessionId}/answer`,
    {
      method: "POST",
      headers: {
        ...learnerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionItemId: diagnosticStart.data.currentItem.sessionItemId,
        answerValue: diagnosticAnswers[diagnosticStart.data.currentItem.questionItemId],
        checkpointToken: "stale-checkpoint-token",
      }),
    },
  );
  assert.equal(staleDiagnostic.status, 409);
  assert.equal(staleDiagnostic.data.message, "Stale submit");

  const diagnosticFirstSubmit = await request(
    `/session/${diagnosticStart.data.sessionId}/answer`,
    {
      method: "POST",
      headers: {
        ...learnerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionItemId: diagnosticStart.data.currentItem.sessionItemId,
        answerValue: diagnosticAnswers[diagnosticStart.data.currentItem.questionItemId],
        checkpointToken: diagnosticStart.data.checkpointToken,
      }),
    },
  );
  assert.equal(diagnosticFirstSubmit.status, 201);

  const duplicateDiagnostic = await request(
    `/session/${diagnosticStart.data.sessionId}/answer`,
    {
      method: "POST",
      headers: {
        ...learnerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionItemId: diagnosticStart.data.currentItem.sessionItemId,
        answerValue: diagnosticAnswers[diagnosticStart.data.currentItem.questionItemId],
        checkpointToken: diagnosticStart.data.checkpointToken,
      }),
    },
  );
  assert.equal(duplicateDiagnostic.status, 409);
  assert.equal(duplicateDiagnostic.data.message, "Duplicate submit");

  let diagnosticSession = await request(`/session/${diagnosticStart.data.sessionId}`, {
    headers: learnerHeaders,
  });
  assert.equal(diagnosticSession.status, 200);
  assert.equal(diagnosticSession.data.currentIndex, 2);

  while (diagnosticSession.data.status !== "completed") {
    const answerValue =
      diagnosticAnswers[diagnosticSession.data.currentItem.questionItemId];

    const submit = await request(
      `/session/${diagnosticSession.data.sessionId}/answer`,
      {
        method: "POST",
        headers: {
          ...learnerHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionItemId: diagnosticSession.data.currentItem.sessionItemId,
          answerValue,
          checkpointToken: diagnosticSession.data.checkpointToken,
        }),
      },
    );
    assert.equal(submit.status, 201);

    if (submit.data.sessionStatus === "completed") {
      break;
    }

    diagnosticSession = await request(
      `/session/${diagnosticStart.data.sessionId}`,
      {
        headers: learnerHeaders,
      },
    );
  }

  const bootAfterDiagnostic = await request("/boot", {
    headers: learnerHeaders,
  });
  assert.equal(bootAfterDiagnostic.status, 200);
  assert.equal(bootAfterDiagnostic.data.nextRoute, "/today");

  const dailyStart = await request("/session/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(dailyStart.status, 201);

  const todayDuringActiveDaily = await request("/today", {
    headers: learnerHeaders,
  });
  assert.equal(todayDuringActiveDaily.status, 200);
  assert.equal(todayDuringActiveDaily.data.hasActiveDailySession, true);
  assert.equal(todayDuringActiveDaily.data.primaryActionLabel, "Resume 10-Min Session");

  const dailyResume = await request("/session/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(dailyResume.status, 201);
  assert.equal(dailyResume.data.sessionId, dailyStart.data.sessionId);

  const staleDaily = await request(`/session/${dailyStart.data.sessionId}/answer`, {
    method: "POST",
    headers: {
      ...learnerHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionItemId: dailyStart.data.currentItem.sessionItemId,
      answerValue: dailyAnswers[dailyStart.data.currentItem.questionItemId],
      checkpointToken: "stale-checkpoint-token",
    }),
  });
  assert.equal(staleDaily.status, 409);
  assert.equal(staleDaily.data.message, "Stale submit");

  let dailySession = await request(`/session/${dailyStart.data.sessionId}`, {
    headers: learnerHeaders,
  });
  assert.equal(dailySession.status, 200);

  let firstDailySubmitPayload = null;

  while (dailySession.data.status !== "completed") {
    const answerValue =
      dailyAnswers[dailySession.data.currentItem.questionItemId] ??
      diagnosticAnswers[dailySession.data.currentItem.questionItemId] ??
      "wrong-answer";

    const submit = await request(`/session/${dailyStart.data.sessionId}/answer`, {
      method: "POST",
      headers: {
        ...learnerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionItemId: dailySession.data.currentItem.sessionItemId,
        answerValue,
        checkpointToken: dailySession.data.checkpointToken,
      }),
    });
    assert.equal(submit.status, 201);

    if (!firstDailySubmitPayload) {
      firstDailySubmitPayload = {
        sessionItemId: dailySession.data.currentItem.sessionItemId,
        answerValue,
        checkpointToken: dailySession.data.checkpointToken,
      };

      const duplicateDaily = await request(
        `/session/${dailyStart.data.sessionId}/answer`,
        {
          method: "POST",
          headers: {
            ...learnerHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(firstDailySubmitPayload),
        },
      );
      assert.equal(duplicateDaily.status, 409);
      assert.equal(duplicateDaily.data.message, "Duplicate submit");
    }

    if (submit.data.sessionStatus === "completed") {
      const completedSubmit = await request(
        `/session/${dailyStart.data.sessionId}/answer`,
        {
          method: "POST",
          headers: {
            ...learnerHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionItemId: dailySession.data.currentItem.sessionItemId,
            answerValue,
            checkpointToken: dailySession.data.checkpointToken,
          }),
        },
      );
      assert.equal(completedSubmit.status, 409);
      assert.equal(completedSubmit.data.message, "Session completed");
      break;
    }

    dailySession = await request(`/session/${dailyStart.data.sessionId}`, {
      headers: learnerHeaders,
    });
  }

  const summary = await request(`/session/${dailyStart.data.sessionId}/summary`, {
    headers: learnerHeaders,
  });
  assert.equal(summary.status, 200);
  assert.equal(summary.data.totalItems, 3);

  const todayAfterDaily = await request("/today", {
    headers: learnerHeaders,
  });
  assert.equal(todayAfterDaily.status, 200);
  assert.equal(todayAfterDaily.data.hasActiveDailySession, false);
  assert.equal(todayAfterDaily.data.primaryActionLabel, "Start 10-Min Session");

  console.log("Learner slice reliability verification passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
