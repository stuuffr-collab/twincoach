import "reflect-metadata";
import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const TEST_LEARNER_PREFIX = "course-pack-test-";

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

test("creates a course pack in draft state", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}create`;

  const response = await request(app.getHttpServer())
    .post("/course-packs")
    .set("x-learner-id", learnerId)
    .send({
      courseTitle: "Intro to Economics",
      primaryLanguage: "en",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.learnerId, learnerId);
  assert.equal(response.body.courseTitle, "Intro to Economics");
  assert.equal(response.body.lifecycleState, "draft");
  assert.equal(response.body.readinessState, "awaiting_documents");
  assert.equal(response.body.documentCount, 0);
});

test("uploads a valid PDF, validates it, and stores a suggested role", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}upload`;
  const coursePackId = await createCoursePack(learnerId, "Biology 101");
  const pdfBuffer = await createTextPdf([
    "Course syllabus\nGrading breakdown\nLearning objectives\nWeek 1 schedule",
  ]);

  const response = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/documents`)
    .set("x-learner-id", learnerId)
    .attach("file", pdfBuffer, {
      filename: "biology101_syllabus.pdf",
      contentType: "application/pdf",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.coursePackId, coursePackId);
  assert.equal(response.body.document.validationStatus, "valid");
  assert.equal(response.body.document.parseStatus, "parsed");
  assert.equal(response.body.document.suggestedRole, "syllabus");
  assert.equal(response.body.readinessState, "awaiting_roles");
  assert.equal(response.body.lifecycleState, "classifying");
});

test("rejects duplicate PDF uploads within the same course pack", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}duplicate`;
  const coursePackId = await createCoursePack(learnerId, "Chemistry 101");
  const pdfBuffer = await createTextPdf([
    "Lecture 1\nAtoms and molecules\nChemical bonding",
  ]);

  const firstUpload = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/documents`)
    .set("x-learner-id", learnerId)
    .attach("file", pdfBuffer, {
      filename: "chem101_lecture1.pdf",
      contentType: "application/pdf",
    });

  assert.equal(firstUpload.status, 201);

  const duplicateUpload = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/documents`)
    .set("x-learner-id", learnerId)
    .attach("file", pdfBuffer, {
      filename: "chem101_lecture1_copy.pdf",
      contentType: "application/pdf",
    });

  assert.equal(duplicateUpload.status, 409);
  assert.equal(duplicateUpload.body.message, "Duplicate document");
});

test("stores blocked state for PDFs that require OCR or have no selectable text", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}blocked`;
  const coursePackId = await createCoursePack(learnerId, "History 101");
  const blankPdf = await createBlankPdf();

  const response = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/documents`)
    .set("x-learner-id", learnerId)
    .attach("file", blankPdf, {
      filename: "history_scanned_pack.pdf",
      contentType: "application/pdf",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.document.validationStatus, "rejected");
  assert.equal(response.body.document.parseStatus, "blocked");
  assert.equal(response.body.document.blockingIssueCode, "ocr_required");
});

test("flags low-text-coverage PDFs with a partial parse warning", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}partial`;
  const coursePackId = await createCoursePack(learnerId, "Statistics 101");
  const sparsePdf = await createTextPdf([
    "Short review notes for week one.",
    "Short recap and formula reminder.",
  ]);

  const response = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/documents`)
    .set("x-learner-id", learnerId)
    .attach("file", sparsePdf, {
      filename: "stats_week1_notes.pdf",
      contentType: "application/pdf",
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.document.validationStatus, "valid");
  assert.equal(response.body.document.parseStatus, "partial");
  assert.deepEqual(response.body.document.warningCodes, ["low_text_coverage"]);
});

test("stores learner role overrides and advances the pack readiness", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}role`;
  const coursePackId = await createCoursePack(learnerId, "Physics 101");
  const pdfBuffer = await createTextPdf([
    "Lecture one\nMotion and vectors\nWorked examples and concept review",
  ]);

  const uploadResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/documents`)
    .set("x-learner-id", learnerId)
    .attach("file", pdfBuffer, {
      filename: "physics_notes_week1.pdf",
      contentType: "application/pdf",
    });

  assert.equal(uploadResponse.status, 201);

  const confirmResponse = await request(app.getHttpServer())
    .post(
      `/course-packs/${coursePackId}/documents/${uploadResponse.body.document.documentId}/role`,
    )
    .set("x-learner-id", learnerId)
    .send({
      confirmedRole: "lecture_notes",
    });

  assert.equal(confirmResponse.status, 200);
  assert.equal(confirmResponse.body.confirmedRole, "lecture_notes");
  assert.equal(confirmResponse.body.readinessState, "awaiting_extraction");

  const packResponse = await request(app.getHttpServer())
    .get(`/course-packs/${coursePackId}`)
    .set("x-learner-id", learnerId);

  assert.equal(packResponse.status, 200);
  assert.equal(packResponse.body.documents[0].confirmedRole, "lecture_notes");
});

test("does not satisfy the instructional-role gate with a rejected document override", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}rejected-role`;
  const coursePackId = await createCoursePack(learnerId, "Accounting 101");
  const validPdf = await createTextPdf([
    "Week 1 lecture notes on assets, liabilities, and equity.",
  ]);
  const blockedPdf = await createBlankPdf();

  const validUpload = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/documents`)
    .set("x-learner-id", learnerId)
    .attach("file", validPdf, {
      filename: "accounting_week1_notes.pdf",
      contentType: "application/pdf",
    });

  assert.equal(validUpload.status, 201);
  assert.equal(validUpload.body.readinessState, "awaiting_roles");

  const blockedUpload = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/documents`)
    .set("x-learner-id", learnerId)
    .attach("file", blockedPdf, {
      filename: "accounting_scanned_pack.pdf",
      contentType: "application/pdf",
    });

  assert.equal(blockedUpload.status, 201);
  assert.equal(blockedUpload.body.document.validationStatus, "rejected");

  const overrideResponse = await request(app.getHttpServer())
    .post(
      `/course-packs/${coursePackId}/documents/${blockedUpload.body.document.documentId}/role`,
    )
    .set("x-learner-id", learnerId)
    .send({
      confirmedRole: "syllabus",
    });

  assert.equal(overrideResponse.status, 200);
  assert.equal(overrideResponse.body.readinessState, "awaiting_roles");
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

async function createBlankPdf() {
  const pdfDocument = await PDFDocument.create();
  pdfDocument.addPage([612, 792]);

  return Buffer.from(await pdfDocument.save());
}
