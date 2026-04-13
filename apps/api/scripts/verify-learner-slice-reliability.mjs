import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
try {
  process.loadEnvFile?.(path.resolve(__dirname, "../.env"));
} catch (error) {
  if (!isMissingEnvFileError(error)) {
    throw error;
  }
}

const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
const contentDir = path.resolve(__dirname, "../../../content/programming_v1");

async function readJson(filename) {
  const file = await fs.readFile(path.join(contentDir, filename), "utf8");

  return JSON.parse(file);
}

async function buildAnswerMap() {
  const fileNames = [
    "diagnostic_tasks.json",
    "practice_tasks_variables.json",
    "practice_tasks_conditionals.json",
    "practice_tasks_loops.json",
    "practice_tasks_functions.json",
    "practice_tasks_tracing.json",
    "practice_tasks_debugging.json",
  ];
  const taskGroups = await Promise.all(fileNames.map((fileName) => readJson(fileName)));

  return new Map(
    taskGroups
      .flat()
      .map((task) => [
        task.taskId,
        {
          correctAnswer: task.correctAnswer,
          answerFormat: task.answerFormat,
          choices: Array.isArray(task.choices) ? task.choices : [],
        },
      ]),
  );
}

async function request(pathname, options = {}) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

function isMissingEnvFileError(error) {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function getWrongAnswer(task) {
  if (task.answerFormat === "short_text") {
    return "__wrong__";
  }

  const wrongChoice = task.choices.find(
    (choice) => choice.choiceId !== task.correctAnswer,
  );

  return wrongChoice?.choiceId ?? "__wrong__";
}

function assertProgrammingStateShape(payload) {
  assert.equal(payload.screenTitle, "Your Programming State");
  assert.match(
    payload.programmingStateCode,
    /^(building_foundations|debugging_focus|steady_progress|recovery_needed)$/,
  );
  assert.ok(payload.focusConceptId);
  assert.ok(payload.focusConceptLabel);
  assert.match(
    payload.sessionMode,
    /^(steady_practice|concept_repair|debugging_drill|recovery_mode)$/,
  );
  assert.ok(payload.sessionModeLabel);
  assert.match(
    payload.rationaleCode,
    /^(recent_concept_errors|repeated_debugging_errors|strong_recent_progress|recent_dropoff)$/,
  );
  assert.ok(payload.rationaleText);
  assert.ok(payload.nextStepText);
  assert.match(
    payload.primaryActionLabel,
    /^(Start today's session|Resume today's session)$/,
  );
}

async function run() {
  const answerMap = await buildAnswerMap();

  const onboarding = await request("/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      priorProgrammingExposure: "none",
      currentComfortLevel: "low",
      biggestDifficulty: "debugging_errors",
      preferredHelpStyle: "debugging_hint",
    }),
  });

  assert.equal(onboarding.status, 201);
  assert.equal(onboarding.data.onboardingComplete, true);
  assert.equal(onboarding.data.nextRoute, "/diagnostic");
  assert.ok(onboarding.data.learnerId);

  const learnerId = onboarding.data.learnerId;
  const learnerHeaders = { "x-learner-id": learnerId };

  const diagnosticStart = await request("/diagnostic/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(diagnosticStart.status, 201);
  assert.equal(diagnosticStart.data.sessionType, "diagnostic");
  assert.equal(diagnosticStart.data.totalItems, 6);
  assert.equal(diagnosticStart.data.currentIndex, 1);
  assert.ok(diagnosticStart.data.checkpointToken);
  assert.ok(diagnosticStart.data.currentTask.taskId);

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
        sessionItemId: diagnosticStart.data.currentTask.sessionItemId,
        answerValue:
          answerMap.get(diagnosticStart.data.currentTask.taskId)?.correctAnswer ?? "c1",
        checkpointToken: "stale-checkpoint-token",
      }),
    },
  );
  assert.equal(staleDiagnostic.status, 409);
  assert.equal(staleDiagnostic.data.message, "Stale submit");

  const firstDiagnosticAnswer = {
    sessionItemId: diagnosticStart.data.currentTask.sessionItemId,
    answerValue:
      answerMap.get(diagnosticStart.data.currentTask.taskId)?.correctAnswer ?? "c1",
    checkpointToken: diagnosticStart.data.checkpointToken,
  };

  const diagnosticFirstSubmit = await request(
    `/session/${diagnosticStart.data.sessionId}/answer`,
    {
      method: "POST",
      headers: {
        ...learnerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(firstDiagnosticAnswer),
    },
  );
  assert.equal(diagnosticFirstSubmit.status, 201);
  assert.equal(diagnosticFirstSubmit.data.isCorrect, true);

  const duplicateDiagnostic = await request(
    `/session/${diagnosticStart.data.sessionId}/answer`,
    {
      method: "POST",
      headers: {
        ...learnerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(firstDiagnosticAnswer),
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
      answerMap.get(diagnosticSession.data.currentTask.taskId)?.correctAnswer ?? "c1";

    const submit = await request(
      `/session/${diagnosticSession.data.sessionId}/answer`,
      {
        method: "POST",
        headers: {
          ...learnerHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionItemId: diagnosticSession.data.currentTask.sessionItemId,
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

  const todayBeforeDaily = await request("/today", {
    headers: learnerHeaders,
  });
  assert.equal(todayBeforeDaily.status, 200);
  assertProgrammingStateShape(todayBeforeDaily.data);
  assert.equal(todayBeforeDaily.data.hasActiveDailySession, false);
  assert.equal(todayBeforeDaily.data.activeSessionId, null);
  assert.equal(todayBeforeDaily.data.primaryActionLabel, "Start today's session");

  const dailyStart = await request("/session/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(dailyStart.status, 201);
  assert.equal(dailyStart.data.sessionType, "daily_practice");
  assert.match(
    dailyStart.data.sessionMode,
    /^(steady_practice|concept_repair|debugging_drill|recovery_mode)$/,
  );
  assert.ok([3, 4].includes(dailyStart.data.totalItems));
  assert.ok(dailyStart.data.focusConceptId);
  assert.ok(typeof dailyStart.data.currentTask.helpAvailable === "boolean");

  const todayDuringActiveDaily = await request("/today", {
    headers: learnerHeaders,
  });
  assert.equal(todayDuringActiveDaily.status, 200);
  assertProgrammingStateShape(todayDuringActiveDaily.data);
  assert.equal(todayDuringActiveDaily.data.hasActiveDailySession, true);
  assert.equal(todayDuringActiveDaily.data.activeSessionId, dailyStart.data.sessionId);
  assert.equal(todayDuringActiveDaily.data.primaryActionLabel, "Resume today's session");

  const dailyResume = await request("/session/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(dailyResume.status, 201);
  assert.equal(dailyResume.data.sessionId, dailyStart.data.sessionId);

  const firstDailyTask = answerMap.get(dailyStart.data.currentTask.taskId);
  assert.ok(firstDailyTask);

  const staleDaily = await request(`/session/${dailyStart.data.sessionId}/answer`, {
    method: "POST",
    headers: {
      ...learnerHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionItemId: dailyStart.data.currentTask.sessionItemId,
      answerValue: firstDailyTask.correctAnswer,
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
  let testedHintOffer = false;

  while (dailySession.data.status !== "completed") {
    const taskDefinition = answerMap.get(dailySession.data.currentTask.taskId);
    assert.ok(taskDefinition);

    const shouldForceIncorrect =
      !testedHintOffer && dailySession.data.currentTask.helpAvailable === true;
    const answerValue = shouldForceIncorrect
      ? getWrongAnswer(taskDefinition)
      : taskDefinition.correctAnswer;

    const submitPayload = {
      sessionItemId: dailySession.data.currentTask.sessionItemId,
      answerValue,
      checkpointToken: dailySession.data.checkpointToken,
    };

    const submit = await request(`/session/${dailyStart.data.sessionId}/answer`, {
      method: "POST",
      headers: {
        ...learnerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submitPayload),
    });
    assert.equal(submit.status, 201);

    if (shouldForceIncorrect) {
      assert.equal(submit.data.isCorrect, false);
      assert.ok(submit.data.helpOffer);
      assert.match(
        submit.data.helpOffer.helpKind,
        /^(step_breakdown|worked_example|debugging_hint|concept_explanation)$/,
      );
      testedHintOffer = true;
    }

    if (!firstDailySubmitPayload) {
      firstDailySubmitPayload = submitPayload;

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
          body: JSON.stringify(submitPayload),
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
  assert.equal(testedHintOffer, true);
  assert.equal(summary.data.sessionId, dailyStart.data.sessionId);
  assert.ok([3, 4].includes(summary.data.completedTaskCount));
  assert.match(
    summary.data.whatImproved.code,
    /^(concept_strengthened|debugging_recovery|steady_completion)$/,
  );
  assert.match(
    summary.data.whatNeedsSupport.code,
    /^(concept_still_needs_support|syntax_still_fragile|debugging_still_needs_structure)$/,
  );
  assert.match(
    summary.data.studyPatternObserved.code,
    /^(recovered_after_mistake|steady_throughout|hesitated_but_completed|needed_hint_to_progress)$/,
  );
  assert.equal(summary.data.nextBestAction.route, "/today");
  assert.equal(summary.data.nextBestAction.label, "Back to Your Programming State");

  const todayAfterDaily = await request("/today", {
    headers: learnerHeaders,
  });
  assert.equal(todayAfterDaily.status, 200);
  assertProgrammingStateShape(todayAfterDaily.data);
  assert.equal(todayAfterDaily.data.hasActiveDailySession, false);
  assert.equal(todayAfterDaily.data.primaryActionLabel, "Start today's session");

  console.log("Programming learner slice reliability verification passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
