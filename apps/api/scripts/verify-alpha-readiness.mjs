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
const adminKey = process.env.ALPHA_OPERATOR_KEY ?? "";
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
    taskGroups.flat().map((task) => [
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
  assert.ok(payload.focusConceptId);
  assert.ok(payload.focusConceptLabel);
  assert.match(
    payload.programmingStateCode,
    /^(building_foundations|debugging_focus|steady_progress|recovery_needed)$/,
  );
  assert.match(
    payload.sessionMode,
    /^(steady_practice|concept_repair|debugging_drill|recovery_mode)$/,
  );
  assert.ok(payload.sessionModeLabel);
  assert.ok(payload.rationaleText);
  assert.ok(payload.nextStepText);
}

async function run() {
  assert.ok(adminKey, "ALPHA_OPERATOR_KEY is required for alpha verification");

  const answerMap = await buildAnswerMap();
  const adminHeaders = {
    "x-admin-key": adminKey,
  };

  const onboarding = await request("/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      priorProgrammingExposure: "school_basics",
      currentComfortLevel: "low",
      biggestDifficulty: "debugging_errors",
      preferredHelpStyle: "debugging_hint",
    }),
  });
  assert.equal(onboarding.status, 201);
  assert.equal(onboarding.data.nextRoute, "/diagnostic");

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
  assert.equal(diagnostic.data.totalItems, 6);

  while (diagnostic.data.status !== "completed") {
    const taskDefinition = answerMap.get(diagnostic.data.currentTask.taskId);
    assert.ok(taskDefinition);

    const submit = await request(`/session/${diagnostic.data.sessionId}/answer`, {
      method: "POST",
      headers: {
        ...learnerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionItemId: diagnostic.data.currentTask.sessionItemId,
        answerValue: taskDefinition.correctAnswer,
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
  assertProgrammingStateShape(todayAfterDiagnostic.data);

  const adminWithoutKey = await request(`/admin/learner/${learnerId}`);
  assert.equal(adminWithoutKey.status, 401);

  const recentLearners = await request("/admin/learners/recent", {
    headers: adminHeaders,
  });
  assert.equal(recentLearners.status, 200);

  const recentLearner = recentLearners.data.find(
    (item) => item.learnerId === learnerId,
  );
  assert.ok(recentLearner);
  assert.ok("focusConceptLabel" in recentLearner);
  assert.ok("sessionMode" in recentLearner);
  assert.ok("sessionMomentumState" in recentLearner);

  const daily = await request("/session/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(daily.status, 201);
  assert.ok([3, 4].includes(daily.data.totalItems));

  const preview = await request(
    `/admin/session/${daily.data.sessionId}/preview`,
    {
      headers: adminHeaders,
    },
  );
  assert.equal(preview.status, 200);
  assert.equal(preview.data.sessionId, daily.data.sessionId);
  assert.ok("sessionMode" in preview.data);
  assert.ok("focusConceptId" in preview.data);
  assert.ok(
    preview.data.items.every(
      (item) => item.taskId && item.conceptId && item.taskType,
    ),
  );

  let dailySession = await request(`/session/${daily.data.sessionId}`, {
    headers: learnerHeaders,
  });
  assert.equal(dailySession.status, 200);

  let revealedHint = false;

  while (dailySession.data.status !== "completed") {
    const taskDefinition = answerMap.get(dailySession.data.currentTask.taskId);
    assert.ok(taskDefinition);

    const shouldForceIncorrect =
      !revealedHint && dailySession.data.currentTask.helpAvailable === true;
    const submit = await request(`/session/${daily.data.sessionId}/answer`, {
      method: "POST",
      headers: {
        ...learnerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionItemId: dailySession.data.currentTask.sessionItemId,
        answerValue: shouldForceIncorrect
          ? getWrongAnswer(taskDefinition)
          : taskDefinition.correctAnswer,
        checkpointToken: dailySession.data.checkpointToken,
      }),
    });
    assert.equal(submit.status, 201);

    if (shouldForceIncorrect) {
      assert.ok(submit.data.helpOffer);

      const telemetryHintReveal = await request("/telemetry", {
        method: "POST",
        headers: {
          ...learnerHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventName: "tc_session_help_revealed",
          route: `/session/${daily.data.sessionId}`,
          sessionId: daily.data.sessionId,
          sessionItemId: dailySession.data.currentTask.sessionItemId,
          properties: {
            sessionId: daily.data.sessionId,
            sessionItemId: dailySession.data.currentTask.sessionItemId,
            taskId: dailySession.data.currentTask.taskId,
            conceptId: dailySession.data.currentTask.conceptId,
            helpKind: submit.data.helpOffer.helpKind,
          },
        }),
      });
      assert.equal(telemetryHintReveal.status, 201);
      revealedHint = true;
    }

    if (submit.data.sessionStatus === "completed") {
      break;
    }

    dailySession = await request(`/session/${daily.data.sessionId}`, {
      headers: learnerHeaders,
    });
    assert.equal(dailySession.status, 200);
  }

  const summary = await request(`/session/${daily.data.sessionId}/summary`, {
    headers: learnerHeaders,
  });
  assert.equal(summary.status, 200);
  assert.equal(summary.data.nextBestAction.route, "/today");
  assert.ok(revealedHint);

  const learnerLookup = await request(`/admin/learner/${learnerId}`, {
    headers: adminHeaders,
  });
  assert.equal(learnerLookup.status, 200);
  assert.deepEqual(learnerLookup.data.onboardingProfile, {
    priorProgrammingExposure: "school_basics",
    currentComfortLevel: "low",
    biggestDifficulty: "debugging_errors",
    preferredHelpStyle: "debugging_hint",
  });
  assert.ok(learnerLookup.data.personaSnapshot.focusConceptId !== undefined);
  assert.ok(Array.isArray(learnerLookup.data.personaSnapshot.conceptStates));
  assert.ok(Array.isArray(learnerLookup.data.recentErrorTags));
  assert.ok(learnerLookup.data.latestSummarySnapshot);
  assert.ok(learnerLookup.data.latestSummarySnapshot.whatImproved.code);
  assert.ok(learnerLookup.data.latestSummarySnapshot.whatNeedsSupport.code);
  assert.ok(
    learnerLookup.data.latestSummarySnapshot.studyPatternObserved.code,
  );

  console.log("Programming alpha readiness verification passed.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
