import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
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

async function postTelemetry(headers, body) {
  const response = await request("/telemetry", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  assert.equal(response.status, 201);
}

async function run() {
  const answerMap = await buildAnswerMap();

  const onboarding = await request("/onboarding/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      priorProgrammingExposure: "none",
      currentComfortLevel: "very_low",
      biggestDifficulty: "tracing_logic",
      preferredHelpStyle: "step_breakdown",
    }),
  });
  assert.equal(onboarding.status, 201);

  const learnerId = onboarding.data.learnerId;
  const learnerHeaders = {
    "x-learner-id": learnerId,
  };

  let diagnostic = await request("/diagnostic/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(diagnostic.status, 201);

  await postTelemetry(learnerHeaders, {
    eventName: "tc_diagnostic_task_viewed",
    route: "/diagnostic",
    sessionId: diagnostic.data.sessionId,
    sessionItemId: diagnostic.data.currentTask.sessionItemId,
    properties: {
      sessionId: diagnostic.data.sessionId,
      sessionItemId: diagnostic.data.currentTask.sessionItemId,
      taskId: diagnostic.data.currentTask.taskId,
      conceptId: diagnostic.data.currentTask.conceptId,
      taskType: diagnostic.data.currentTask.taskType,
      currentIndex: diagnostic.data.currentIndex,
      totalItems: diagnostic.data.totalItems,
    },
  });

  const firstDiagnosticTask = answerMap.get(diagnostic.data.currentTask.taskId);
  assert.ok(firstDiagnosticTask);

  const diagnosticSubmit = await request(
    `/session/${diagnostic.data.sessionId}/answer`,
    {
      method: "POST",
      headers: {
        ...learnerHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionItemId: diagnostic.data.currentTask.sessionItemId,
        answerValue: firstDiagnosticTask.correctAnswer,
        checkpointToken: diagnostic.data.checkpointToken,
      }),
    },
  );
  assert.equal(diagnosticSubmit.status, 201);

  await postTelemetry(learnerHeaders, {
    eventName: "tc_diagnostic_answer_submitted",
    route: "/diagnostic",
    sessionId: diagnostic.data.sessionId,
    sessionItemId: diagnostic.data.currentTask.sessionItemId,
    properties: {
      sessionId: diagnostic.data.sessionId,
      sessionItemId: diagnostic.data.currentTask.sessionItemId,
      taskId: diagnostic.data.currentTask.taskId,
      conceptId: diagnostic.data.currentTask.conceptId,
      taskType: diagnostic.data.currentTask.taskType,
      attemptCount: 1,
      timeToFirstActionMs: 200,
      timeToSubmitMs: 1400,
      isCorrect: diagnosticSubmit.data.isCorrect,
    },
  });

  diagnostic = await request(`/session/${diagnostic.data.sessionId}`, {
    headers: learnerHeaders,
  });
  assert.equal(diagnostic.status, 200);

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

  const today = await request("/today", {
    headers: learnerHeaders,
  });
  assert.equal(today.status, 200);

  const daily = await request("/session/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(daily.status, 201);

  const resumedDaily = await request("/session/create-or-resume", {
    method: "POST",
    headers: learnerHeaders,
  });
  assert.equal(resumedDaily.status, 201);
  assert.equal(resumedDaily.data.sessionId, daily.data.sessionId);

  let dailySession = await request(`/session/${daily.data.sessionId}`, {
    headers: learnerHeaders,
  });
  assert.equal(dailySession.status, 200);

  let revealedHint = false;

  while (dailySession.data.status !== "completed") {
    const taskDefinition = answerMap.get(dailySession.data.currentTask.taskId);
    assert.ok(taskDefinition);

    await postTelemetry(learnerHeaders, {
      eventName: "tc_session_task_viewed",
      route: `/session/${daily.data.sessionId}`,
      sessionId: daily.data.sessionId,
      sessionItemId: dailySession.data.currentTask.sessionItemId,
      properties: {
        sessionId: daily.data.sessionId,
        sessionMode: dailySession.data.sessionMode,
        sessionItemId: dailySession.data.currentTask.sessionItemId,
        taskId: dailySession.data.currentTask.taskId,
        conceptId: dailySession.data.currentTask.conceptId,
        taskType: dailySession.data.currentTask.taskType,
        currentIndex: dailySession.data.currentIndex,
        totalItems: dailySession.data.totalItems,
      },
    });

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

    await postTelemetry(learnerHeaders, {
      eventName: "tc_session_answer_submitted",
      route: `/session/${daily.data.sessionId}`,
      sessionId: daily.data.sessionId,
      sessionItemId: dailySession.data.currentTask.sessionItemId,
      properties: {
        sessionId: daily.data.sessionId,
        sessionMode: dailySession.data.sessionMode,
        sessionItemId: dailySession.data.currentTask.sessionItemId,
        taskId: dailySession.data.currentTask.taskId,
        conceptId: dailySession.data.currentTask.conceptId,
        taskType: dailySession.data.currentTask.taskType,
        attemptCount: 1,
        timeToFirstActionMs: 300,
        timeToSubmitMs: 1600,
        isCorrect: submit.data.isCorrect,
      },
    });

    if (shouldForceIncorrect) {
      assert.ok(submit.data.helpOffer);

      await postTelemetry(learnerHeaders, {
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
      });

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
  assert.equal(revealedHint, true);

  const telemetryEvents = await prisma.telemetryEvent.findMany({
    where: {
      learnerId,
    },
    orderBy: {
      occurredAt: "asc",
    },
  });

  const eventNames = new Set(telemetryEvents.map((event) => event.eventName));

  for (const expectedEventName of [
    "tc_onboarding_completed",
    "tc_diagnostic_started",
    "tc_diagnostic_task_viewed",
    "tc_diagnostic_answer_submitted",
    "tc_programming_state_viewed",
    "tc_session_started",
    "tc_session_task_viewed",
    "tc_session_answer_submitted",
    "tc_session_help_revealed",
    "tc_session_resumed",
    "tc_session_completed",
    "tc_summary_viewed",
  ]) {
    assert.ok(eventNames.has(expectedEventName), `Missing ${expectedEventName}`);
  }

  const submittedEvent = telemetryEvents.find(
    (event) => event.eventName === "tc_session_answer_submitted",
  );
  assert.ok(submittedEvent);
  assert.ok("primaryErrorTag" in submittedEvent.properties);

  const hintedAttempt = await prisma.attempt.findFirst({
    where: {
      learnerId,
      sessionId: daily.data.sessionId,
      helpKindUsed: {
        not: null,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  assert.ok(hintedAttempt);

  console.log("Programming telemetry verification passed.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
