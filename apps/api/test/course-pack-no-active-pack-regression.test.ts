import "reflect-metadata";
import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const TEST_LEARNER_PREFIX = "course-pack-regression-test-";

let app: INestApplication;
let prisma: PrismaService;

before(async () => {
  process.loadEnvFile?.(".env");

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  await app.init();
  prisma = app.get(PrismaService);
});

beforeEach(async () => {
  if (!prisma) {
    return;
  }

  await prisma.learner.deleteMany({
    where: {
      id: {
        startsWith: TEST_LEARNER_PREFIX,
      },
    },
  });
});

after(async () => {
  if (prisma) {
    await prisma.learner.deleteMany({
      where: {
        id: {
          startsWith: TEST_LEARNER_PREFIX,
        },
      },
    });
  }

  await app?.close();
});

test("current TwinCoach learner flow stays unchanged when no active course pack exists", async () => {
  const onboardingResponse = await request(app.getHttpServer())
    .post("/onboarding/complete")
    .set("x-learner-id", `${TEST_LEARNER_PREFIX}baseline`)
    .send({
      priorProgrammingExposure: "none",
      currentComfortLevel: "low",
      biggestDifficulty: "debugging_errors",
      preferredHelpStyle: "debugging_hint",
    });

  assert.equal(onboardingResponse.status, 201);
  const learnerId = onboardingResponse.body.learnerId as string;

  const diagnosticResponse = await request(app.getHttpServer())
    .post("/diagnostic/create-or-resume")
    .set("x-learner-id", learnerId);

  assert.equal(diagnosticResponse.status, 201);

  let diagnosticSession = diagnosticResponse.body;

  while (diagnosticSession.status !== "completed") {
    const task = await prisma.programmingTask.findUniqueOrThrow({
      where: {
        id: diagnosticSession.currentTask.taskId,
      },
    });

    const submitResponse = await request(app.getHttpServer())
      .post(`/session/${diagnosticSession.sessionId}/answer`)
      .set("x-learner-id", learnerId)
      .send({
        sessionItemId: diagnosticSession.currentTask.sessionItemId,
        answerValue: task.correctAnswer,
        checkpointToken: diagnosticSession.checkpointToken,
      });

    assert.equal(submitResponse.status, 201);

    if (submitResponse.body.sessionStatus === "completed") {
      break;
    }

    const nextDiagnosticResponse = await request(app.getHttpServer())
      .get(`/session/${diagnosticSession.sessionId}`)
      .set("x-learner-id", learnerId);

    assert.equal(nextDiagnosticResponse.status, 200);
    diagnosticSession = nextDiagnosticResponse.body;
  }

  const todayResponse = await request(app.getHttpServer())
    .get("/today")
    .set("x-learner-id", learnerId);

  assert.equal(todayResponse.status, 200);
  assert.equal(todayResponse.body.activeCourseContext, null);
  assert.equal(todayResponse.body.focusCompiledConceptId, null);
  assert.match(todayResponse.body.focusConceptId, /^py_c0/);

  const dailySessionResponse = await request(app.getHttpServer())
    .post("/session/create-or-resume")
    .set("x-learner-id", learnerId);

  assert.equal(dailySessionResponse.status, 201);
  assert.equal(dailySessionResponse.body.activeCourseContext, null);
  assert.equal(dailySessionResponse.body.focusCompiledConceptId, null);

  const persistedSession = await prisma.session.findUniqueOrThrow({
    where: {
      id: dailySessionResponse.body.sessionId,
    },
  });

  assert.equal(persistedSession.activeCoursePackId, null);
  assert.equal(persistedSession.focusCompiledConceptId, null);

  let dailySession = dailySessionResponse.body;

  while (dailySession.status !== "completed") {
    const task = await prisma.programmingTask.findUniqueOrThrow({
      where: {
        id: dailySession.currentTask.taskId,
      },
    });

    const submitResponse = await request(app.getHttpServer())
      .post(`/session/${dailySession.sessionId}/answer`)
      .set("x-learner-id", learnerId)
      .send({
        sessionItemId: dailySession.currentTask.sessionItemId,
        answerValue: task.correctAnswer,
        checkpointToken: dailySession.checkpointToken,
      });

    assert.equal(submitResponse.status, 201);

    if (submitResponse.body.sessionStatus === "completed") {
      break;
    }

    const nextDailyResponse = await request(app.getHttpServer())
      .get(`/session/${dailySession.sessionId}`)
      .set("x-learner-id", learnerId);

    assert.equal(nextDailyResponse.status, 200);
    dailySession = nextDailyResponse.body;
  }

  const summaryResponse = await request(app.getHttpServer())
    .get(`/session/${dailySessionResponse.body.sessionId}/summary`)
    .set("x-learner-id", learnerId);

  assert.equal(summaryResponse.status, 200);
  assert.equal(summaryResponse.body.activeCourseContext, null);
  assert.equal(summaryResponse.body.focusCompiledConceptId, null);
  assert.match(summaryResponse.body.focusConceptId, /^py_c0/);

  const compiledStates = await prisma.learnerCompiledCoachConceptState.findMany({
    where: {
      learnerId,
    },
  });

  assert.equal(compiledStates.length, 0);
});
