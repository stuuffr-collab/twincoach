import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PDFDocument, StandardFonts } from "pdf-lib";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const TEST_LEARNER_PREFIX = "course-pack-follow-through-test-";

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
  "keeps a refreshed area sticky for one follow-through session when the first restart session still needs support",
  { concurrency: false },
  async () => {
    const learnerId = `${TEST_LEARNER_PREFIX}continuity`;
    const coursePackId = await createCoursePack(learnerId, "Applied Programming Continuity");

    await uploadAndConfirmRole({
      learnerId,
      coursePackId,
      filename: "continuity_syllabus.pdf",
      confirmedRole: "syllabus",
      pages: [
        "Unit 1: Foundations\nConcepts: Variables, Expressions, Conditionals\nMidterm review covers variables, expressions, and conditionals.\nStudents revisit variables, expressions, and branch decisions in weekly review.",
      ],
    });
    await uploadAndConfirmRole({
      learnerId,
      coursePackId,
      filename: "continuity_functions.pdf",
      confirmedRole: "lecture_notes",
      pages: [
        "Unit 2: Functions\nConcepts: Functions, Parameters, Return Values, Tracing\nFunctions build on variables and conditionals.\nWorkshops review functions, parameter flow, returned values, and tracing function calls.",
      ],
    });
    await uploadAndConfirmRole({
      learnerId,
      coursePackId,
      filename: "continuity_exam.pdf",
      confirmedRole: "past_exam",
      pages: [
        "Past exam review\nConcepts: Variables, Functions, Tracing, Debugging\nPast papers combine variables, functions, tracing, and debugging in exam-style questions.",
      ],
    });

    const initialExtraction = await request(app.getHttpServer())
      .post(`/course-packs/${coursePackId}/extraction`)
      .set("x-learner-id", learnerId);

    assert.equal(initialExtraction.status, 201);

    const initialConfirmation = await request(app.getHttpServer())
      .post(`/course-packs/${coursePackId}/confirmations`)
      .set("x-learner-id", learnerId)
      .send({
        acknowledgeLowConfidence: false,
      });

    assert.equal(initialConfirmation.status, 201);

    const initialActivation = await request(app.getHttpServer())
      .post(`/course-packs/${coursePackId}/activate`)
      .set("x-learner-id", learnerId)
      .send({
        confirmationSnapshotId: initialConfirmation.body.confirmationSnapshotId,
      });

    assert.equal(initialActivation.status, 201);

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
      filename: "continuity_loops.pdf",
      confirmedRole: "slides",
      pages: [
        "Unit 3: Loops\nConcepts: Loops, Loop Tracing\nFinal review now includes loops and loop tracing.\nLoop workshops add new practice around repeated state changes and tracing inside repetition.",
      ],
    });

    const refreshExtraction = await request(app.getHttpServer())
      .post(`/course-packs/${coursePackId}/extraction`)
      .set("x-learner-id", learnerId);

    assert.equal(refreshExtraction.status, 201);

    const refreshConfirmation = await request(app.getHttpServer())
      .post(`/course-packs/${coursePackId}/confirmations`)
      .set("x-learner-id", learnerId)
      .send({
        acknowledgeLowConfidence: false,
      });

    assert.equal(refreshConfirmation.status, 201);

    const refreshActivation = await request(app.getHttpServer())
      .post(`/course-packs/${coursePackId}/activate`)
      .set("x-learner-id", learnerId)
      .send({
        confirmationSnapshotId: refreshConfirmation.body.confirmationSnapshotId,
      });

    assert.equal(refreshActivation.status, 201);

    const firstTodayResponse = await request(app.getHttpServer())
      .get("/today")
      .set("x-learner-id", learnerId);

    assert.equal(firstTodayResponse.status, 200);
    assert.equal(
      firstTodayResponse.body.activeCourseContext.refreshContext.firstSessionPending,
      true,
    );
    assert.equal(firstTodayResponse.body.activeCourseContext.followThrough, null);

    const firstSessionResponse = await request(app.getHttpServer())
      .post("/session/create-or-resume")
      .set("x-learner-id", learnerId);

    assert.equal(firstSessionResponse.status, 201);
    assert.equal(firstSessionResponse.body.refreshHandoff.isFirstSessionAfterRefresh, true);

    await completeDailySession({
      learnerId,
      sessionId: firstSessionResponse.body.sessionId,
      answerMode: "one_wrong_then_correct",
    });

    const firstSummaryResponse = await request(app.getHttpServer())
      .get(`/session/${firstSessionResponse.body.sessionId}/summary`)
      .set("x-learner-id", learnerId);

    assert.equal(firstSummaryResponse.status, 200);
    assert.equal(firstSummaryResponse.body.refreshHandoff.isFirstSessionAfterRefresh, true);
    assert.equal(firstSummaryResponse.body.activeCourseContext.followThrough != null, true);
    assert.equal(
      firstSummaryResponse.body.activeCourseContext.followThrough.targetNormalizedConceptId,
      refreshActivation.body.activeCourseContext.focusNormalizedConceptId,
    );

    const secondTodayResponse = await request(app.getHttpServer())
      .get("/today")
      .set("x-learner-id", learnerId);

    assert.equal(secondTodayResponse.status, 200);
    assert.equal(
      secondTodayResponse.body.activeCourseContext.followThrough.targetNormalizedConceptId,
      refreshActivation.body.activeCourseContext.focusNormalizedConceptId,
    );
    assert.equal(secondTodayResponse.body.focusConceptLabel.length > 0, true);

    const secondSessionResponse = await request(app.getHttpServer())
      .post("/session/create-or-resume")
      .set("x-learner-id", learnerId);

    assert.equal(secondSessionResponse.status, 201);
    assert.equal(secondSessionResponse.body.refreshHandoff.isFirstSessionAfterRefresh, false);
    assert.equal(secondSessionResponse.body.activeCourseContext.followThrough != null, true);
    assert.equal(
      secondSessionResponse.body.activeCourseContext.followThrough.targetNormalizedConceptId,
      refreshActivation.body.activeCourseContext.focusNormalizedConceptId,
    );

    await completeDailySession({
      learnerId,
      sessionId: secondSessionResponse.body.sessionId,
      answerMode: "all_correct",
    });

    const secondSummaryResponse = await request(app.getHttpServer())
      .get(`/session/${secondSessionResponse.body.sessionId}/summary`)
      .set("x-learner-id", learnerId);

    assert.equal(secondSummaryResponse.status, 200);
    assert.equal(secondSummaryResponse.body.refreshHandoff.isFirstSessionAfterRefresh, false);
    assert.equal(secondSummaryResponse.body.activeCourseContext.followThrough, null);
    assert.equal(secondSummaryResponse.body.activeCourseContext.resolution != null, true);
    assert.equal(
      secondSummaryResponse.body.activeCourseContext.resolution.resolvedNormalizedConceptId,
      refreshActivation.body.activeCourseContext.focusNormalizedConceptId,
    );

    const returnTodayResponse = await request(app.getHttpServer())
      .get("/today")
      .set("x-learner-id", learnerId);

    assert.equal(returnTodayResponse.status, 200);
    assert.equal(returnTodayResponse.body.activeCourseContext.followThrough, null);
    assert.equal(returnTodayResponse.body.activeCourseContext.resolution != null, true);

    const normalSessionResponse = await request(app.getHttpServer())
      .post("/session/create-or-resume")
      .set("x-learner-id", learnerId);

    assert.equal(normalSessionResponse.status, 201);
    assert.equal(normalSessionResponse.body.refreshHandoff != null, true);
    assert.equal(normalSessionResponse.body.refreshHandoff.isResolutionSession, true);
    assert.equal(normalSessionResponse.body.activeCourseContext.followThrough, null);
    assert.equal(normalSessionResponse.body.activeCourseContext.resolution != null, true);

    await completeDailySession({
      learnerId,
      sessionId: normalSessionResponse.body.sessionId,
      answerMode: "all_correct",
    });

    const finalTodayResponse = await request(app.getHttpServer())
      .get("/today")
      .set("x-learner-id", learnerId);

    assert.equal(finalTodayResponse.status, 200);
    assert.equal(finalTodayResponse.body.activeCourseContext.followThrough, null);
    assert.equal(finalTodayResponse.body.activeCourseContext.resolution, null);
  },
);

async function completeDailySession(input: {
  learnerId: string;
  sessionId: string;
  answerMode: "all_correct" | "one_wrong_then_correct";
}) {
  let sessionResponse = await request(app.getHttpServer())
    .get(`/session/${input.sessionId}`)
    .set("x-learner-id", input.learnerId);

  assert.equal(sessionResponse.status, 200);

  let wrongAnswerUsed = false;

  while (true) {
    const sessionPayload = sessionResponse.body;
    const task = await prisma.programmingTask.findUniqueOrThrow({
      where: {
        id: sessionPayload.currentTask.taskId,
      },
    });
    const answerValue =
      input.answerMode === "one_wrong_then_correct" && !wrongAnswerUsed
        ? "__definitely_wrong__"
        : task.correctAnswer;
    const answerResponse = await request(app.getHttpServer())
      .post(`/session/${input.sessionId}/answer`)
      .set("x-learner-id", input.learnerId)
      .send({
        sessionItemId: sessionPayload.currentTask.sessionItemId,
        answerValue,
        checkpointToken: sessionPayload.checkpointToken,
      });

    assert.equal(answerResponse.status, 201);

    if (!wrongAnswerUsed && answerValue !== task.correctAnswer) {
      wrongAnswerUsed = true;
    }

    if (answerResponse.body.sessionStatus === "completed") {
      break;
    }

    sessionResponse = await request(app.getHttpServer())
      .get(`/session/${input.sessionId}`)
      .set("x-learner-id", input.learnerId);

    assert.equal(sessionResponse.status, 200);
  }
}

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
