import "reflect-metadata";
import assert from "node:assert/strict";
import test, { after, before, beforeEach } from "node:test";
import request from "supertest";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

const TEST_LEARNER_PREFIX = "course-pack-management-test-";

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

test("lists learner course packs, shows the active pack first, and archives inactive packs safely", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}list`;
  const activePackId = await prepareActivatablePack({
    learnerId,
    courseTitle: "Applied Statistics",
    filenamePrefix: "stats",
  });
  const inactivePackId = await createCoursePack(
    learnerId,
    "Economic History",
  );

  const activationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${activePackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({});

  assert.equal(activationResponse.status, 201);

  const initialListResponse = await request(app.getHttpServer())
    .get("/course-packs")
    .set("x-learner-id", learnerId);

  assert.equal(initialListResponse.status, 200);
  assert.equal(initialListResponse.body.length, 2);
  assert.equal(initialListResponse.body[0].coursePackId, activePackId);
  assert.equal(initialListResponse.body[0].isActive, true);
  assert.equal(initialListResponse.body[1].coursePackId, inactivePackId);

  const archiveActiveResponse = await request(app.getHttpServer())
    .post(`/course-packs/${activePackId}/archive`)
    .set("x-learner-id", learnerId)
    .send({});

  assert.equal(archiveActiveResponse.status, 400);
  assert.match(archiveActiveResponse.body.message, /active course pack/i);

  const archiveInactiveResponse = await request(app.getHttpServer())
    .post(`/course-packs/${inactivePackId}/archive`)
    .set("x-learner-id", learnerId)
    .send({});

  assert.equal(archiveInactiveResponse.status, 201);
  assert.equal(archiveInactiveResponse.body.coursePackId, inactivePackId);
  assert.equal(archiveInactiveResponse.body.lifecycleState, "archived");
  assert.equal(archiveInactiveResponse.body.isActive, false);
  assert.ok(archiveInactiveResponse.body.archivedAt);

  const archivedListResponse = await request(app.getHttpServer())
    .get("/course-packs")
    .set("x-learner-id", learnerId);

  assert.equal(archivedListResponse.status, 200);
  assert.equal(archivedListResponse.body.length, 2);
  assert.equal(archivedListResponse.body[0].coursePackId, activePackId);
  assert.equal(archivedListResponse.body[1].coursePackId, inactivePackId);
  assert.equal(archivedListResponse.body[1].lifecycleState, "archived");
});

test("can switch back to a previously active pack without re-confirming it", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}switch`;
  const firstPackId = await prepareActivatablePack({
    learnerId,
    courseTitle: "Cell Biology",
    filenamePrefix: "bio",
  });
  const secondPackId = await prepareActivatablePack({
    learnerId,
    courseTitle: "Linear Algebra",
    filenamePrefix: "math",
  });

  const firstActivationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${firstPackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({});

  assert.equal(firstActivationResponse.status, 201);
  assert.equal(firstActivationResponse.body.coursePackId, firstPackId);
  assert.equal(firstActivationResponse.body.isActive, true);

  const secondActivationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${secondPackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({});

  assert.equal(secondActivationResponse.status, 201);
  assert.equal(secondActivationResponse.body.coursePackId, secondPackId);
  assert.equal(secondActivationResponse.body.isActive, true);

  const switchedBackResponse = await request(app.getHttpServer())
    .post(`/course-packs/${firstPackId}/activate`)
    .set("x-learner-id", learnerId)
    .send({});

  assert.equal(switchedBackResponse.status, 201);
  assert.equal(switchedBackResponse.body.coursePackId, firstPackId);
  assert.equal(switchedBackResponse.body.isActive, true);

  const listResponse = await request(app.getHttpServer())
    .get("/course-packs")
    .set("x-learner-id", learnerId);

  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body[0].coursePackId, firstPackId);
  assert.equal(listResponse.body[0].isActive, true);
  assert.equal(listResponse.body[1].coursePackId, secondPackId);
  assert.equal(listResponse.body[1].isActive, false);
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
}) {
  const coursePackId = await createCoursePack(input.learnerId, input.courseTitle);

  await uploadAndConfirmRole({
    learnerId: input.learnerId,
    coursePackId,
    filename: `${input.filenamePrefix}_syllabus.pdf`,
    confirmedRole: "syllabus",
    pages: [
      `Unit 1: ${input.courseTitle} Foundations\nConcepts: Core ideas, Key definitions, Review priorities\nMidterm exam includes core ideas and review priorities.\nWeekly practice revisits key definitions and review priorities.`,
    ],
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
