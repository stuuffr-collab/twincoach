import "reflect-metadata";
import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const TEST_LEARNER_PREFIX = "course-pack-drift-test-";

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

test("marks active packs as stale and pending refresh when new documents are added", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}add`;
  const coursePackId = await prepareActivatablePack({
    learnerId,
    courseTitle: "Organic Chemistry",
    filenamePrefix: "chem",
    pages: [
      "Unit 1: Bonding\nConcepts: Atomic structure, Bond polarity, Lewis structures\nMidterm covers atomic structure and bond polarity.",
    ],
  });

  const activationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({});

  assert.equal(activationResponse.status, 201);

  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "chem_week2_notes.pdf",
    confirmedRole: "lecture_notes",
    pages: [
      "Unit 2: Reactions\nConcepts: Reaction energy, Catalysts, Mechanisms\nWeekly review revisits catalysts.",
    ],
  });

  const packResponse = await request(app.getHttpServer())
    .get(`/course-packs/${coursePackId}`)
    .set("x-learner-id", learnerId);

  assert.equal(packResponse.status, 200);
  assert.equal(packResponse.body.isActive, true);
  assert.equal(packResponse.body.driftStatus, "pending_refresh");
  assert.equal(packResponse.body.activeContextState, "stale");
  assert.equal(packResponse.body.requiresReconfirmation, false);
  assert.match(
    packResponse.body.readinessState,
    /awaiting_extraction|awaiting_roles/,
  );
  assert.ok(
    (packResponse.body.driftReasonCodes as string[]).includes(
      "documents_added",
    ),
  );

  const addedDocumentId = packResponse.body.documents.find(
    (document: { originalFilename: string }) =>
      document.originalFilename === "chem_week2_notes.pdf",
  )?.documentId as string | undefined;

  assert.ok(addedDocumentId);

  const removeResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/documents/${addedDocumentId}/remove`)
    .set("x-learner-id", learnerId)
    .send({});

  assert.equal(removeResponse.status, 200);
});

test("keeps prior confirmation valid after equivalent replace and safe remove when extraction results stay materially stable", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}stable`;
  const coursePackId = await createCoursePack(learnerId, "Microeconomics");

  const syllabusDocumentId = await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "micro_syllabus.pdf",
    confirmedRole: "syllabus",
    pages: [
      "Unit 1: Supply and Demand\nConcepts: Demand curves, Supply curves, Equilibrium\nMidterm includes demand curves and equilibrium.\nWeekly review revisits equilibrium.",
    ],
  });
  const initialExtractionResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/extraction`)
    .set("x-learner-id", learnerId);

  assert.equal(initialExtractionResponse.status, 201);

  const initialConfirmationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/confirmations`)
    .set("x-learner-id", learnerId)
    .send({
      acknowledgeLowConfidence: false,
    });

  assert.equal(initialConfirmationResponse.status, 201);
  const initialConfirmationSnapshotId =
    initialConfirmationResponse.body.confirmationSnapshotId as string;

  const replaceResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/documents/${syllabusDocumentId}/replace`)
    .set("x-learner-id", learnerId)
    .attach(
      "file",
      await createTextPdf([
        "Unit 1: Supply and Demand\nConcepts: Demand curves, Supply curves, Equilibrium\nMidterm includes demand curves and equilibrium.\nWeekly review revisits equilibrium.",
        "Instructor note: bring your calculator to class.",
      ]),
      {
        filename: "micro_syllabus_v2.pdf",
        contentType: "application/pdf",
      },
    );

  assert.equal(replaceResponse.status, 201);

  const refreshedExtractionResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/extraction`)
    .set("x-learner-id", learnerId);

  assert.equal(refreshedExtractionResponse.status, 201);

  const packResponse = await request(app.getHttpServer())
    .get(`/course-packs/${coursePackId}`)
    .set("x-learner-id", learnerId);

  assert.equal(packResponse.status, 200);
  assert.equal(packResponse.body.driftStatus, "clean");
  assert.equal(packResponse.body.requiresReconfirmation, false);
  assert.equal(packResponse.body.readinessState, "activation_ready");
  assert.equal(packResponse.body.lifecycleState, "confirmed");
  assert.equal(packResponse.body.documents.length, 1);

  const activationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({});

  assert.equal(activationResponse.status, 201);
  assert.equal(
    activationResponse.body.confirmationSnapshotId,
    initialConfirmationSnapshotId,
  );
});

test("requires re-review for meaningful drift and keeps active context stale until refreshed", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}meaningful`;
  const coursePackId = await prepareActivatablePack({
    learnerId,
    courseTitle: "World History",
    filenamePrefix: "history",
    pages: [
      "Unit 1: Early Civilizations\nConcepts: River valleys, Early states, Writing systems\nMidterm includes river valleys and writing systems.",
    ],
  });

  const firstActivationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({});

  assert.equal(firstActivationResponse.status, 201);

  const originalSyllabus = await prisma.sourceDocument.findFirstOrThrow({
    where: {
      coursePackId,
      originalFilename: "history_syllabus.pdf",
    },
  });

  const replaceResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/documents/${originalSyllabus.id}/replace`)
    .set("x-learner-id", learnerId)
    .attach(
      "file",
      await createTextPdf([
        "Unit 1: Industrial Revolution\nConcepts: Factories, Urbanization, Labor movements\nFinal exam emphasizes factories and labor movements.",
      ]),
      {
        filename: "history_syllabus_updated.pdf",
        contentType: "application/pdf",
      },
    );

  assert.equal(replaceResponse.status, 201);

  const extractionResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/extraction`)
    .set("x-learner-id", learnerId);

  assert.equal(extractionResponse.status, 201);

  const stalePackResponse = await request(app.getHttpServer())
    .get(`/course-packs/${coursePackId}`)
    .set("x-learner-id", learnerId);

  assert.equal(stalePackResponse.status, 200);
  assert.equal(stalePackResponse.body.isActive, true);
  assert.equal(stalePackResponse.body.driftStatus, "review_required");
  assert.equal(stalePackResponse.body.requiresReconfirmation, true);
  assert.equal(stalePackResponse.body.activeContextState, "stale");
  assert.equal(stalePackResponse.body.readinessState, "review_ready");
  assert.ok(
    (stalePackResponse.body.driftReasonCodes as string[]).includes(
      "course_graph_changed",
    ),
  );

  const blockedActivationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({});

  assert.equal(blockedActivationResponse.status, 400);
  assert.match(
    blockedActivationResponse.body.message,
    /review|confirmation|refresh/i,
  );

  const confirmationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/confirmations`)
    .set("x-learner-id", learnerId)
    .send({
      acknowledgeLowConfidence: false,
    });

  assert.equal(confirmationResponse.status, 201);

  const postConfirmationPackResponse = await request(app.getHttpServer())
    .get(`/course-packs/${coursePackId}`)
    .set("x-learner-id", learnerId);

  assert.equal(postConfirmationPackResponse.status, 200);
  assert.equal(postConfirmationPackResponse.body.requiresReconfirmation, false);
  assert.equal(postConfirmationPackResponse.body.driftStatus, "clean");
  assert.equal(postConfirmationPackResponse.body.activeContextState, "stale");
  assert.ok(
    (postConfirmationPackResponse.body.driftReasonCodes as string[]).includes(
      "activation_refresh_required",
    ),
  );

  const refreshedActivationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({});

  assert.equal(refreshedActivationResponse.status, 201);

  const refreshedPackResponse = await request(app.getHttpServer())
    .get(`/course-packs/${coursePackId}`)
    .set("x-learner-id", learnerId);

  assert.equal(refreshedPackResponse.status, 200);
  assert.equal(refreshedPackResponse.body.driftStatus, "clean");
  assert.equal(refreshedPackResponse.body.activeContextState, "current");
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

async function prepareActivatablePack(input: {
  learnerId: string;
  courseTitle: string;
  filenamePrefix: string;
  pages: string[];
}) {
  const coursePackId = await createCoursePack(input.learnerId, input.courseTitle);

  await uploadAndConfirmRole({
    learnerId: input.learnerId,
    coursePackId,
    filename: `${input.filenamePrefix}_syllabus.pdf`,
    confirmedRole: "syllabus",
    pages: input.pages,
  });

  const extractionResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/extraction`)
    .set("x-learner-id", input.learnerId);

  assert.equal(extractionResponse.status, 201);
  assert.notEqual(
    extractionResponse.body.supportLevelAssessment.candidateSupportLevel,
    "not_ready",
  );

  const confirmationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/confirmations`)
    .set("x-learner-id", input.learnerId)
    .send({
      acknowledgeLowConfidence: false,
    });

  assert.equal(confirmationResponse.status, 201);

  return coursePackId;
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
