import "reflect-metadata";
import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const TEST_LEARNER_PREFIX = "course-pack-extraction-test-";

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

test("runs extraction and persists snapshot, graph, blueprint, and support-level candidate", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}run`;
  const coursePackId = await createCoursePack(learnerId, "Intro Programming");
  const syllabusDocumentId = await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "intro_programming_syllabus.pdf",
    confirmedRole: "syllabus",
    pages: [
      "Unit 1: Foundations\nConcepts: Variables, Expressions, Conditionals\nMidterm coverage includes variables, expressions, and conditionals.",
    ],
  });
  const lectureDocumentId = await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "intro_programming_week2_notes.pdf",
    confirmedRole: "lecture_notes",
    pages: [
      "Unit 2: Problem Solving\nConcepts: Loops, Iteration, Functions\nVariables before loops.\n- tracing practice",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "intro_programming_past_exam.pdf",
    confirmedRole: "past_exam",
    pages: [
      "Final exam topics: Debugging; Tracing; Loops\nDebugging and tracing problem solving with loops.",
    ],
  });

  assert.ok(syllabusDocumentId);
  assert.ok(lectureDocumentId);

  const extractionResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/extraction`)
    .set("x-learner-id", learnerId);

  assert.equal(extractionResponse.status, 201);
  assert.ok(extractionResponse.body.extractionSnapshotId);
  assert.ok(extractionResponse.body.units.length >= 2);
  assert.ok(extractionResponse.body.concepts.length >= 4);
  assert.ok(extractionResponse.body.sourceEvidence.length >= 4);
  assert.ok(extractionResponse.body.dependencyCandidates.length >= 1);
  assert.ok(extractionResponse.body.recurringThemes.length >= 1);
  assert.ok(extractionResponse.body.courseGraph);
  assert.ok(extractionResponse.body.courseGraph.units.length >= 2);
  assert.ok(extractionResponse.body.courseGraph.concepts.length >= 3);
  assert.ok(extractionResponse.body.examBlueprint);
  assert.ok(extractionResponse.body.examBlueprint.areas.length >= 2);
  assert.equal(
    extractionResponse.body.examBlueprint.areas.reduce(
      (sum: number, area: { suggestedTimeSharePct: number }) =>
        sum + area.suggestedTimeSharePct,
      0,
    ),
    100,
  );
  assert.equal(
    extractionResponse.body.supportLevelAssessment.candidateSupportLevel,
    "guided_study",
  );
  assert.ok(extractionResponse.body.supportLevelAssessment.parseIntegrityScore >= 0.7);
  assert.ok(
    extractionResponse.body.supportLevelAssessment.structureConfidenceScore >=
      0.6,
  );

  const packResponse = await request(app.getHttpServer())
    .get(`/course-packs/${coursePackId}`)
    .set("x-learner-id", learnerId);

  assert.equal(packResponse.status, 200);
  assert.equal(packResponse.body.lifecycleState, "awaiting_confirmation");
  assert.equal(packResponse.body.readinessState, "review_ready");
  assert.equal(packResponse.body.supportLevelCandidate, "guided_study");
  assert.ok(packResponse.body.unsupportedTopicCount >= 0);

  const latestExtractionResponse = await request(app.getHttpServer())
    .get(`/course-packs/${coursePackId}/extraction`)
    .set("x-learner-id", learnerId);

  assert.equal(latestExtractionResponse.status, 200);
  assert.equal(
    latestExtractionResponse.body.extractionSnapshotId,
    extractionResponse.body.extractionSnapshotId,
  );
});

test("keeps low-confidence extracted concepts outside the persisted graph", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}low-confidence`;
  const coursePackId = await createCoursePack(learnerId, "Biology Review");

  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "biology_notes.pdf",
    confirmedRole: "lecture_notes",
    pages: [
      "Unit 1: Cells\nConcepts: Membrane Transport, Cell Structure\nExam review includes cell structure.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "biology_reference_pack.pdf",
    confirmedRole: "reference",
    pages: [
      "Supplemental appendix appendix appendix glossary glossary glossary bibliography bibliography bibliography",
    ],
  });

  const extractionResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/extraction`)
    .set("x-learner-id", learnerId);

  assert.equal(extractionResponse.status, 201);
  assert.ok(
    extractionResponse.body.concepts.length >
      extractionResponse.body.courseGraph.concepts.length,
  );
  assert.ok(extractionResponse.body.lowConfidenceItemCount >= 1);
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
