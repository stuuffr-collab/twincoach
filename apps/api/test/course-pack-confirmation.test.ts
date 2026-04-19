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

const TEST_LEARNER_PREFIX = "course-pack-confirmation-test-";

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

test("persists confirmation snapshots with edits, removals, reordering, merges, and exam-importance marks", async () => {
  const learnerId = `${TEST_LEARNER_PREFIX}actions`;
  const coursePackId = await createCoursePack(learnerId, "Programming Foundations");

  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "programming_syllabus.pdf",
    confirmedRole: "syllabus",
    pages: [
      "Unit 1: Foundations\nConcepts: Variables, Expressions, Conditionals\nMidterm includes variables, expressions, and conditionals.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "programming_notes_week2.pdf",
    confirmedRole: "lecture_notes",
    pages: [
      "Unit 2: Control Flow\nConcepts: Loops, Tracing, Debugging\nVariables before loops.\n- tracing practice",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "programming_functions_notes.pdf",
    confirmedRole: "lecture_notes",
    pages: [
      "Unit 3: Abstractions\nConcepts: Functions, Parameters, Return Values\nFinal exam covers functions and debugging.",
    ],
  });
  await uploadAndConfirmRole({
    learnerId,
    coursePackId,
    filename: "programming_past_exam.pdf",
    confirmedRole: "past_exam",
    pages: [
      "Past exam review\nConcepts: Variables, Loops, Functions, Debugging\nTracing loops before debugging.",
    ],
  });

  const extractionResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/extraction`)
    .set("x-learner-id", learnerId);

  assert.equal(extractionResponse.status, 201);

  const units = extractionResponse.body.units as Array<{
    unitCandidateId: string;
    rawTitle: string;
  }>;
  const graphConcepts = extractionResponse.body.courseGraph.concepts as Array<{
    sourceConceptCandidateId: string;
    label: string;
    graphConceptId: string;
    unitId: string | null;
  }>;
  const graphUnits = extractionResponse.body.courseGraph.units as Array<{
    graphUnitId: string;
    sourceUnitCandidateId: string;
  }>;

  assert.ok(units.length >= 3);
  assert.ok(graphConcepts.length >= 5);

  const firstGraphUnit = graphUnits[0];
  const firstUnitConcepts = graphConcepts.filter(
    (concept) => concept.unitId === firstGraphUnit.graphUnitId,
  );

  assert.ok(firstUnitConcepts.length >= 2);

  const mergeTarget = firstUnitConcepts[0]!;
  const mergeSource = firstUnitConcepts[1]!;
  const removedConcept = graphConcepts.find(
    (concept) =>
      concept.sourceConceptCandidateId !== mergeTarget.sourceConceptCandidateId &&
      concept.sourceConceptCandidateId !== mergeSource.sourceConceptCandidateId,
  );
  const irrelevantConcept = graphConcepts.find(
    (concept) =>
      concept.sourceConceptCandidateId !== mergeTarget.sourceConceptCandidateId &&
      concept.sourceConceptCandidateId !== mergeSource.sourceConceptCandidateId &&
      concept.sourceConceptCandidateId !== removedConcept?.sourceConceptCandidateId,
  );

  assert.ok(removedConcept);
  assert.ok(irrelevantConcept);

  const confirmationResponse = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/confirmations`)
    .set("x-learner-id", learnerId)
    .send({
      unitEdits: [
        {
          sourceUnitCandidateId: units[0]!.unitCandidateId,
          label: "Programming Core",
        },
      ],
      conceptEdits: [
        {
          sourceConceptCandidateId: mergeTarget.sourceConceptCandidateId,
          label: "Variables and Expressions",
        },
      ],
      removedItemIds: [removedConcept!.sourceConceptCandidateId],
      reorderedUnitIds: [...units].reverse().map((unit) => unit.unitCandidateId),
      mergeActions: [
        {
          targetSourceConceptCandidateId: mergeTarget.sourceConceptCandidateId,
          sourceConceptCandidateIds: [mergeSource.sourceConceptCandidateId],
        },
      ],
      examImportantConceptIds: [mergeTarget.sourceConceptCandidateId],
      irrelevantItemIds: [irrelevantConcept!.sourceConceptCandidateId],
      acknowledgeLowConfidence: false,
    });

  assert.equal(confirmationResponse.status, 201);
  assert.equal(confirmationResponse.body.status, "confirmed");
  assert.equal(confirmationResponse.body.mergeActionCount, 1);
  assert.ok(confirmationResponse.body.editedItemCount >= 4);
  assert.equal(confirmationResponse.body.lowConfidenceIncludedCount, 0);
  assert.equal(
    confirmationResponse.body.units[0].sourceUnitCandidateId,
    units[units.length - 1]!.unitCandidateId,
  );

  const mergedConcept = confirmationResponse.body.concepts.find(
    (concept: { sourceConceptCandidateId: string }) =>
      concept.sourceConceptCandidateId === mergeTarget.sourceConceptCandidateId,
  );

  assert.ok(mergedConcept);
  assert.equal(mergedConcept.label, "Variables and Expressions");
  assert.equal(mergedConcept.isExamImportant, true);
  assert.deepEqual(
    mergedConcept.mergedSourceConceptCandidateIds.sort(),
    [
      mergeSource.sourceConceptCandidateId,
      mergeTarget.sourceConceptCandidateId,
    ].sort(),
  );
  assert.equal(
    confirmationResponse.body.concepts.some(
      (concept: { sourceConceptCandidateId: string }) =>
        concept.sourceConceptCandidateId === removedConcept!.sourceConceptCandidateId,
    ),
    false,
  );
  assert.equal(
    confirmationResponse.body.concepts.some(
      (concept: { sourceConceptCandidateId: string }) =>
        concept.sourceConceptCandidateId ===
        irrelevantConcept!.sourceConceptCandidateId,
    ),
    false,
  );

  const latestConfirmationResponse = await request(app.getHttpServer())
    .get(`/course-packs/${coursePackId}/confirmations/latest`)
    .set("x-learner-id", learnerId);

  assert.equal(latestConfirmationResponse.status, 200);
  assert.equal(
    latestConfirmationResponse.body.confirmationSnapshotId,
    confirmationResponse.body.confirmationSnapshotId,
  );

  const packResponse = await request(app.getHttpServer())
    .get(`/course-packs/${coursePackId}`)
    .set("x-learner-id", learnerId);

  assert.equal(packResponse.status, 200);
  assert.equal(packResponse.body.lifecycleState, "confirmed");
  assert.equal(packResponse.body.readinessState, "activation_ready");
});

test("requires low-confidence acknowledgment when confirmation includes extraction-only concepts", async () => {
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

  const graphConceptIds = new Set(
    (extractionResponse.body.courseGraph.concepts as Array<{
      sourceConceptCandidateId: string;
    }>).map((concept) => concept.sourceConceptCandidateId),
  );
  const lowConfidenceConcept = (
    extractionResponse.body.concepts as Array<{
      conceptCandidateId: string;
    }>
  ).find((concept) => !graphConceptIds.has(concept.conceptCandidateId));

  assert.ok(lowConfidenceConcept);

  const rejectedConfirmation = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/confirmations`)
    .set("x-learner-id", learnerId)
    .send({
      confirmedConceptCandidateIds: [lowConfidenceConcept!.conceptCandidateId],
      acknowledgeLowConfidence: false,
    });

  assert.equal(rejectedConfirmation.status, 400);
  assert.equal(
    rejectedConfirmation.body.message,
    "Low-confidence items require explicit acknowledgment",
  );

  const acceptedConfirmation = await request(app.getHttpServer())
    .post(`/course-packs/${coursePackId}/confirmations`)
    .set("x-learner-id", learnerId)
    .send({
      confirmedConceptCandidateIds: [lowConfidenceConcept!.conceptCandidateId],
      acknowledgeLowConfidence: true,
    });

  assert.equal(acceptedConfirmation.status, 201);
  assert.ok(acceptedConfirmation.body.lowConfidenceIncludedCount >= 1);
  assert.equal(acceptedConfirmation.body.lowConfidenceAcknowledged, true);
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
