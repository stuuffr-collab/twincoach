import "reflect-metadata";
import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const TEST_LEARNER_PREFIX = "course-pack-admin-test-";
const TEST_ADMIN_KEY = "test-alpha-operator-key";

let app: INestApplication;
let prisma: PrismaService;
let originalAdminKey: string | undefined;

before(async () => {
  process.loadEnvFile?.(".env");
  originalAdminKey = process.env.ALPHA_OPERATOR_KEY;
  process.env.ALPHA_OPERATOR_KEY = TEST_ADMIN_KEY;

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

  if (originalAdminKey == null) {
    delete process.env.ALPHA_OPERATOR_KEY;
  } else {
    process.env.ALPHA_OPERATOR_KEY = originalAdminKey;
  }

  await app?.close();
});

test("operator endpoints expose course-pack lifecycle, extraction, confirmation, activation, and compilation state", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}ops`;
  const coursePackId = await createCoursePack(learnerId, "Systems Programming");

  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "systems_programming_syllabus.pdf",
    confirmedRole: "syllabus",
    pages: [
      "Unit 1: Foundations\nConcepts: Variables, Expressions, Conditionals\nMidterm exam includes variables, expressions, and conditionals.\nWeekly practice covers variables, expressions, and conditionals with traced examples and short reasoning prompts.\nStudents review variable updates, expression evaluation, and branch decisions before the midterm.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "systems_programming_flow_notes.pdf",
    confirmedRole: "lecture_notes",
    pages: [
      "Unit 2: Control Flow\nConcepts: Loops, Tracing, Debugging\nLoops before debugging.\nTracing builds on variables and conditionals.\nControl flow workshops emphasize loop tracing, conditional tracing, debugging repeated mistakes, and step-by-step reasoning practice.\nStudents revisit loops, tracing, and debugging in guided weekly review.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "systems_programming_functions.pdf",
    confirmedRole: "slides",
    pages: [
      "Unit 3: Functions\nConcepts: Functions, Parameters, Return Values\nFinal exam includes functions and debugging.\nFunction labs practice parameters, return values, tracing function calls, and debugging incorrect outputs.\nStudents review function structure, parameter flow, and returned results before the final exam.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "systems_programming_past_exam.pdf",
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

  const sessionResponse = await request(app.getHttpServer())
    .post("/session/create-or-resume")
    .set("x-learner-id", learnerId);

  assert.equal(sessionResponse.status, 201);

  const unauthorizedResponse = await request(app.getHttpServer()).get(
    `/admin/learner/${learnerId}`,
  );

  assert.equal(unauthorizedResponse.status, 401);

  const recentLearnersResponse = await request(app.getHttpServer())
    .get("/admin/learners/recent")
    .set("x-admin-key", TEST_ADMIN_KEY);

  assert.equal(recentLearnersResponse.status, 200);
  const recentLearner = recentLearnersResponse.body.find(
    (item: { learnerId: string }) => item.learnerId === learnerId,
  );
  assert.ok(recentLearner);
  assert.equal(recentLearner.activeCourseContext.coursePackId, coursePackId);
  assert.equal(recentLearner.activeCourseContext.supportLevel, "full_coach");

  const learnerLookupResponse = await request(app.getHttpServer())
    .get(`/admin/learner/${learnerId}`)
    .set("x-admin-key", TEST_ADMIN_KEY);

  assert.equal(learnerLookupResponse.status, 200);
  assert.equal(
    learnerLookupResponse.body.activeCourseContext.coursePackId,
    coursePackId,
  );
  assert.equal(learnerLookupResponse.body.coursePacks.length, 1);

  const pack = learnerLookupResponse.body.coursePacks[0];
  assert.equal(pack.coursePackId, coursePackId);
  assert.equal(pack.lifecycleState, "active");
  assert.equal(pack.readinessState, "activation_ready");
  assert.equal(pack.supportLevelCandidate, "full_coach");
  assert.equal(pack.supportLevelFinal, "full_coach");
  assert.equal(pack.isActive, true);
  assert.equal(pack.documents.length, 4);
  assert.ok(pack.documents.every((document: { parseStatus: string }) => document.parseStatus === "parsed"));
  assert.ok(pack.latestExtraction);
  assert.ok(pack.latestExtraction.averageConfidenceScore > 0);
  assert.ok(pack.latestExtraction.unitCount >= 3);
  assert.ok(pack.latestExtraction.conceptCount >= 5);
  assert.ok(pack.latestExtraction.unsupportedTopicCount >= 0);
  assert.equal(
    pack.supportLevelAssessment.candidateSupportLevel,
    "full_coach",
  );
  assert.equal(pack.latestConfirmation.status, "activated");
  assert.ok(pack.latestConfirmation.confirmedUnitCount >= 3);
  assert.ok(pack.latestConfirmation.confirmedConceptCount >= 5);
  assert.equal(pack.activation.isActive, true);
  assert.equal(pack.activation.supportLevelFinal, "full_coach");
  assert.equal(pack.compilation.compilationStatus, "compiled");
  assert.ok(pack.compilation.normalizedConceptCount >= 5);
  assert.ok(Array.isArray(pack.unsupportedTopics));

  const previewResponse = await request(app.getHttpServer())
    .get(`/admin/session/${sessionResponse.body.sessionId}/preview`)
    .set("x-admin-key", TEST_ADMIN_KEY);

  assert.equal(previewResponse.status, 200);
  assert.equal(
    previewResponse.body.activeCourseContext.coursePackId,
    coursePackId,
  );
  assert.equal(previewResponse.body.activeCourseContext.supportLevel, "full_coach");
  assert.equal(
    previewResponse.body.focusCompiledConceptId,
    previewResponse.body.activeCourseContext.focusNormalizedConceptId,
  );
  assert.ok(previewResponse.body.items.length >= 3);
});

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
