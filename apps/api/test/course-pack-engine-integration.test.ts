import "reflect-metadata";
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const TEST_LEARNER_PREFIX = "course-pack-engine-test-";

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

after(async () => {
  if (!prisma || !app) {
    return;
  }

  await prisma.learner.deleteMany({
    where: {
      id: {
        startsWith: TEST_LEARNER_PREFIX,
      },
    },
  });
  await app.close();
});

test(
  "today, session, summary, and compiled concept state all read the active course context",
  { concurrency: false },
  async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}flow`;
  const coursePackId = await createCoursePack(learnerId, "Applied Programming");

  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "applied_programming_syllabus.pdf",
    confirmedRole: "syllabus",
    pages: [
      "Unit 1: Foundations\nConcepts: Variables, Expressions, Conditionals\nMidterm exam includes variables, expressions, and conditionals.\nWeekly practice covers variables, expressions, and conditionals with traced examples and short reasoning prompts.\nStudents review variable updates, expression evaluation, and branch decisions before the midterm.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "applied_programming_flow_notes.pdf",
    confirmedRole: "lecture_notes",
    pages: [
      "Unit 2: Control Flow\nConcepts: Loops, Tracing, Debugging\nLoops before debugging.\nTracing builds on variables and conditionals.\nControl flow workshops emphasize loop tracing, conditional tracing, debugging repeated mistakes, and step-by-step reasoning practice.\nStudents revisit loops, tracing, and debugging in guided weekly review.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "applied_programming_functions.pdf",
    confirmedRole: "slides",
    pages: [
      "Unit 3: Functions\nConcepts: Functions, Parameters, Return Values\nFinal exam includes functions and debugging.\nFunction labs practice parameters, return values, tracing function calls, and debugging incorrect outputs.\nStudents review function structure, parameter flow, and returned results before the final exam.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "applied_programming_past_exam.pdf",
    confirmedRole: "past_exam",
    pages: [
      "Past exam review\nConcepts: Variables, Loops, Functions, Debugging, Tracing\nDebugging requires tracing.\nPast exams repeatedly combine variables, loops, functions, tracing, and debugging in exam-style review questions.\nPractice papers show that tracing and debugging are essential before answering function and loop questions.",
    ],
  });

  const extractionResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/extraction`)
    .set("x-learner-id", learnerId);

  assert.equal(extractionResponse.status, 201);
  assert.equal(
    extractionResponse.body.supportLevelAssessment.candidateSupportLevel,
    "full_coach",
  );

  const confirmationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/confirmations`)
    .set("x-learner-id", learnerId)
    .send({
      acknowledgeLowConfidence: false,
    });

  assert.equal(confirmationResponse.status, 201);

  const activationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({
      confirmationSnapshotId: confirmationResponse.body.confirmationSnapshotId,
    });

  assert.equal(activationResponse.status, 201);
  assert.equal(activationResponse.body.supportLevelFinal, "full_coach");

  const onboardingResponse = await request(app.getHttpServer())
    .post("/onboarding/complete")
    .set("x-learner-id", learnerId)
    .send({
      priorProgrammingExposure: "school_basics",
      currentComfortLevel: "low",
      biggestDifficulty: "tracing_logic",
      preferredHelpStyle: "step_breakdown",
    });

  assert.equal(onboardingResponse.status, 201);

  await ensureCompletedDiagnostic(learnerId);

  const todayResponse = await request(app.getHttpServer())
    .get("/today")
    .set("x-learner-id", learnerId);

  assert.equal(todayResponse.status, 200);
  assert.equal(todayResponse.body.activeCourseContext.coursePackId, coursePackId);
  assert.equal(todayResponse.body.activeCourseContext.supportLevel, "full_coach");
  assert.equal(
    todayResponse.body.focusConceptId,
    todayResponse.body.activeCourseContext.focusEngineConceptId,
  );
  assert.equal(
    todayResponse.body.focusCompiledConceptId,
    todayResponse.body.activeCourseContext.focusNormalizedConceptId,
  );

  const sessionResponse = await request(app.getHttpServer())
    .post("/session/create-or-resume")
    .set("x-learner-id", learnerId);

  assert.equal(sessionResponse.status, 201);
  assert.equal(sessionResponse.body.activeCourseContext.coursePackId, coursePackId);
  assert.ok(sessionResponse.body.focusCompiledConceptId);

  const createdSession = await prisma.session.findUniqueOrThrow({
    where: {
      id: sessionResponse.body.sessionId,
    },
  });

  assert.equal(createdSession.activeCoursePackId, coursePackId);
  assert.equal(
    createdSession.focusCompiledConceptId,
    sessionResponse.body.focusCompiledConceptId,
  );

  let sessionPayload = sessionResponse.body;

  while (true) {
    const task = await prisma.programmingTask.findUniqueOrThrow({
      where: {
        id: sessionPayload.currentTask.taskId,
      },
    });
    const answerResponse = await request(app.getHttpServer())
      .post(`/session/${sessionPayload.sessionId}/answer`)
      .set("x-learner-id", learnerId)
      .send({
        sessionItemId: sessionPayload.currentTask.sessionItemId,
        answerValue: task.correctAnswer,
        checkpointToken: sessionPayload.checkpointToken,
      });

    assert.equal(answerResponse.status, 201);

    if (answerResponse.body.sessionStatus === "completed") {
      break;
    }

    const nextSessionResponse = await request(app.getHttpServer())
      .get(`/session/${sessionPayload.sessionId}`)
      .set("x-learner-id", learnerId);

    assert.equal(nextSessionResponse.status, 200);
    sessionPayload = nextSessionResponse.body;
  }

  const summaryResponse = await request(app.getHttpServer())
    .get(`/session/${sessionResponse.body.sessionId}/summary`)
    .set("x-learner-id", learnerId);

  assert.equal(summaryResponse.status, 200);
  assert.equal(summaryResponse.body.activeCourseContext.coursePackId, coursePackId);
  assert.equal(
    summaryResponse.body.focusCompiledConceptId,
    activationResponse.body.activeCourseContext.focusNormalizedConceptId,
  );
  assert.equal(summaryResponse.body.focusConceptLabel.length > 0, true);

  const compiledState = await prisma.learnerCompiledCoachConceptState.findUnique({
    where: {
      learnerId_coursePackId_compiledCoachConceptId: {
        learnerId,
        coursePackId,
        compiledCoachConceptId:
          activationResponse.body.activeCourseContext.focusNormalizedConceptId,
      },
    },
  });

  assert.ok(compiledState);
  assert.equal(compiledState?.lastObservedAt instanceof Date, true);

  const followupTodayResponse = await request(app.getHttpServer())
    .get("/today")
    .set("x-learner-id", learnerId);

  assert.equal(followupTodayResponse.status, 200);
  assert.equal(
    Array.isArray(followupTodayResponse.body.packProgressMemory?.recentFocusHistory),
    true,
  );
  assert.equal(
    followupTodayResponse.body.packProgressMemory?.recentFocusHistory.length > 0,
    true,
  );
  assert.equal(
    typeof followupTodayResponse.body.packProgressMemory?.recentFocusHistory[0]
      ?.label,
    "string",
  );
  },
);

test(
  "today, first session, and summary expose the post-refresh handoff after a meaningful pack update",
  { concurrency: false },
  async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}refresh-handoff`;
  const coursePackId = await createCoursePack(learnerId, "Applied Programming Refresh");

  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "refresh_syllabus.pdf",
    confirmedRole: "syllabus",
    pages: [
      "Unit 1: Foundations\nConcepts: Variables, Expressions, Conditionals\nMidterm review covers variables, expressions, and conditionals.\nStudents revisit variables, expressions, and branch decisions in weekly review.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "refresh_functions.pdf",
    confirmedRole: "lecture_notes",
    pages: [
      "Unit 2: Functions\nConcepts: Functions, Parameters, Return Values, Tracing\nFunctions build on variables and conditionals.\nWorkshops review functions, parameter flow, returned values, and tracing function calls.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "refresh_past_exam.pdf",
    confirmedRole: "past_exam",
    pages: [
      "Past exam review\nConcepts: Variables, Functions, Tracing, Debugging\nPast papers combine variables, functions, tracing, and debugging in exam-style questions.",
    ],
  });

  const firstExtraction = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/extraction`)
    .set("x-learner-id", learnerId);

  assert.equal(firstExtraction.status, 201);

  const firstConfirmation = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/confirmations`)
    .set("x-learner-id", learnerId)
    .send({
      acknowledgeLowConfidence: false,
    });

  assert.equal(firstConfirmation.status, 201);

  const firstActivation = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({
      confirmationSnapshotId: firstConfirmation.body.confirmationSnapshotId,
    });

  assert.equal(firstActivation.status, 201);

  const onboardingResponse = await request(app.getHttpServer())
    .post("/onboarding/complete")
    .set("x-learner-id", learnerId)
    .send({
      priorProgrammingExposure: "school_basics",
      currentComfortLevel: "low",
      biggestDifficulty: "tracing_logic",
      preferredHelpStyle: "step_breakdown",
    });

  assert.equal(onboardingResponse.status, 201);

  await ensureCompletedDiagnostic(learnerId);

  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "refresh_loops.pdf",
    confirmedRole: "slides",
    pages: [
      "Unit 3: Loops\nConcepts: Loops, Loop Tracing\nFinal review now includes loops and loop tracing.\nLoop workshops add new practice around repeated state changes and tracing inside repetition.",
    ],
  });

  const secondExtraction = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/extraction`)
    .set("x-learner-id", learnerId);

  assert.equal(secondExtraction.status, 201);

  const secondConfirmation = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/confirmations`)
    .set("x-learner-id", learnerId)
    .send({
      acknowledgeLowConfidence: false,
    });

  assert.equal(secondConfirmation.status, 201);

  const secondActivation = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({
      confirmationSnapshotId: secondConfirmation.body.confirmationSnapshotId,
    });

  assert.equal(secondActivation.status, 201);

  const todayResponse = await request(app.getHttpServer())
    .get("/today")
    .set("x-learner-id", learnerId);

  assert.equal(todayResponse.status, 200);
  assert.equal(
    [
      "new_material",
      "changed_blueprint_priority",
      "changed_concept",
      "support_level_impact",
    ].includes(todayResponse.body.activeCourseContext.refreshContext.reasonType),
    true,
  );
  assert.equal(
    todayResponse.body.activeCourseContext.refreshContext.firstSessionPending,
    true,
  );
  assert.equal(
    typeof todayResponse.body.activeCourseContext.refreshContext.sourceLabel,
    "string",
  );

  const sessionResponse = await request(app.getHttpServer())
    .post("/session/create-or-resume")
    .set("x-learner-id", learnerId);

  assert.equal(sessionResponse.status, 201);
  assert.equal(
    [
      "new_material",
      "changed_blueprint_priority",
      "changed_concept",
      "support_level_impact",
    ].includes(sessionResponse.body.refreshHandoff.reasonType),
    true,
  );
  assert.equal(
    sessionResponse.body.refreshHandoff.isFirstSessionAfterRefresh,
    true,
  );

  let sessionPayload = sessionResponse.body;

  while (true) {
    const task = await prisma.programmingTask.findUniqueOrThrow({
      where: {
        id: sessionPayload.currentTask.taskId,
      },
    });
    const answerResponse = await request(app.getHttpServer())
      .post(`/session/${sessionPayload.sessionId}/answer`)
      .set("x-learner-id", learnerId)
      .send({
        sessionItemId: sessionPayload.currentTask.sessionItemId,
        answerValue: task.correctAnswer,
        checkpointToken: sessionPayload.checkpointToken,
      });

    assert.equal(answerResponse.status, 201);

    if (answerResponse.body.sessionStatus === "completed") {
      break;
    }

    const nextSessionResponse = await request(app.getHttpServer())
      .get(`/session/${sessionPayload.sessionId}`)
      .set("x-learner-id", learnerId);

    assert.equal(nextSessionResponse.status, 200);
    sessionPayload = nextSessionResponse.body;
  }

  const summaryResponse = await request(app.getHttpServer())
    .get(`/session/${sessionResponse.body.sessionId}/summary`)
    .set("x-learner-id", learnerId);

  assert.equal(summaryResponse.status, 200);
  assert.equal(
    [
      "new_material",
      "changed_blueprint_priority",
      "changed_concept",
      "support_level_impact",
    ].includes(summaryResponse.body.refreshHandoff.reasonType),
    true,
  );
  assert.equal(
    summaryResponse.body.refreshHandoff.isFirstSessionAfterRefresh,
    true,
  );
  },
);

async function ensureCompletedDiagnostic(learnerId: string) {
  const examCycle = await prisma.examCycle.findFirstOrThrow({
    where: {
      learnerId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await prisma.session.create({
    data: {
      id: randomUUID(),
      learnerId,
      examCycleId: examCycle.id,
      sessionType: "diagnostic",
      status: "completed",
      currentIndex: 6,
      totalItems: 6,
      checkpointToken: randomUUID(),
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });
}

async function createCoursePack(learnerId: string, courseTitle: string) {
  const response = await request(app.getHttpServer())
    .post("/course-packs")
    .set("x-learner-id", learnerId)
    .send({
      courseTitle,
      primaryLanguage: "en",
    });

  assert.equal(response.status, 201);

  return response.body.coursePackId as string;
}

async function uploadAndConfirmRole(input: {
  learnerId: string;
  coursePackId: string;
  filename: string;
  confirmedRole: string;
  pages: string[];
}) {
  const pdfBuffer = await createTextPdf(input.pages);
  const uploadResponse = await request(app.getHttpServer())
    .post(`/course-packs/${input.coursePackId}/documents`)
    .set("x-learner-id", input.learnerId)
    .attach("file", pdfBuffer, {
      filename: input.filename,
      contentType: "application/pdf",
    });

  assert.equal(uploadResponse.status, 201);

  const confirmResponse = await request(app.getHttpServer())
    .post(
      `/course-packs/${input.coursePackId}/documents/${uploadResponse.body.document.documentId}/role`,
    )
    .set("x-learner-id", input.learnerId)
    .send({
      confirmedRole: input.confirmedRole,
    });

  assert.equal(confirmResponse.status, 200);

  return uploadResponse.body.document.documentId as string;
}

async function createTextPdf(pages: string[]) {
  const pdfDocument = await PDFDocument.create();
  const font = await pdfDocument.embedFont(StandardFonts.Helvetica);

  for (const pageText of pages) {
    const page = pdfDocument.addPage([612, 792]);
    page.drawText(pageText, {
      x: 48,
      y: 700,
      size: 14,
      font,
      lineHeight: 20,
      maxWidth: 500,
    });
  }

  return Buffer.from(await pdfDocument.save());
}
