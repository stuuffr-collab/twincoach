import "reflect-metadata";
import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const TEST_LEARNER_PREFIX = "course-pack-activation-test-";

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

test("activates a confirmed full-coach pack and reuses the compiled artifact on repeated activation", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}activate`;
  const coursePackId = await createCoursePack(learnerId, "CS Foundations");

  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "cs_foundations_syllabus.pdf",
    confirmedRole: "syllabus",
    pages: [
      "Unit 1: Foundations\nConcepts: Variables, Expressions, Conditionals\nMidterm exam includes variables, expressions, and conditionals.\nWeekly practice covers variables, expressions, and conditionals with traced examples and short reasoning prompts.\nStudents review variable updates, expression evaluation, and branch decisions before the midterm.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "cs_foundations_flow_notes.pdf",
    confirmedRole: "lecture_notes",
    pages: [
      "Unit 2: Control Flow\nConcepts: Loops, Tracing, Debugging\nLoops before debugging.\nTracing builds on variables and conditionals.\nControl flow workshops emphasize loop tracing, conditional tracing, debugging repeated mistakes, and step-by-step reasoning practice.\nStudents revisit loops, tracing, and debugging in guided weekly review.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "cs_foundations_functions.pdf",
    confirmedRole: "slides",
    pages: [
      "Unit 3: Functions\nConcepts: Functions, Parameters, Return Values\nFinal exam includes functions and debugging.\nFunction labs practice parameters, return values, tracing function calls, and debugging incorrect outputs.\nStudents review function structure, parameter flow, and returned results before the final exam.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "cs_foundations_past_exam.pdf",
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
  assert.equal(activationResponse.body.lifecycleState, "active");
  assert.equal(activationResponse.body.isActive, true);
  assert.equal(activationResponse.body.supportLevelFinal, "full_coach");
  assert.ok(activationResponse.body.compiledCoachPack.compiledCoachPackId);
  assert.ok(activationResponse.body.compiledCoachPack.focusNormalizedConceptId);
  assert.ok(activationResponse.body.compiledCoachPack.focusEngineConceptId);
  assert.ok(
    activationResponse.body.compiledCoachPack.normalizedConcepts.length >= 5,
  );
  assert.equal(
    activationResponse.body.activeCourseContext.coursePackId,
    coursePackId,
  );
  assert.equal(
    activationResponse.body.activeCourseContext.supportLevel,
    "full_coach",
  );

  const compiledCoachPack = await prisma.compiledCoachPack.findUnique({
    where: {
      id: activationResponse.body.compiledCoachPack.compiledCoachPackId,
    },
    include: {
      concepts: true,
    },
  });

  assert.ok(compiledCoachPack);
  assert.equal(compiledCoachPack?.supportLevel, "full_coach");
  assert.ok(compiledCoachPack?.concepts.every((concept) => concept.sourceEvidenceIds.length > 0));

  const activeContext = await prisma.activeCourseContext.findUnique({
    where: {
      learnerId,
    },
  });

  assert.ok(activeContext);
  assert.equal(activeContext?.coursePackId, coursePackId);
  assert.equal(activeContext?.supportLevel, "full_coach");

  const conceptStates = await prisma.learnerCompiledCoachConceptState.findMany({
    where: {
      learnerId,
      coursePackId,
    },
  });

  assert.equal(
    conceptStates.length,
    activationResponse.body.compiledCoachPack.normalizedConcepts.length,
  );

  const repeatedActivation = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({
      confirmationSnapshotId: confirmationResponse.body.confirmationSnapshotId,
    });

  assert.equal(repeatedActivation.status, 201);
  assert.equal(
    repeatedActivation.body.compiledCoachPack.compiledCoachPackId,
    activationResponse.body.compiledCoachPack.compiledCoachPackId,
  );
});

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
