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

const TEST_LEARNER_PREFIX = "course-pack-recurring-resolution-test-";

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
  "distinguishes recent-memory residue from a legitimate return to a previously resolved recurring area",
  { concurrency: false },
  async () => {
    const learnerId = `${TEST_LEARNER_PREFIX}reentry`;
    const coursePackId = await createCoursePack(
      learnerId,
      "Applied Programming Recurrence",
    );

    await uploadAndConfirmRole({
      learnerId,
      coursePackId,
      filename: "recurrence_syllabus.pdf",
      confirmedRole: "syllabus",
      pages: [
        "Unit 1: Foundations\nConcepts: Variables, Expressions, Conditionals\nMidterm review covers variables, expressions, and conditionals.",
      ],
    });
    await uploadAndConfirmRole({
      learnerId,
      coursePackId,
      filename: "recurrence_flow_notes.pdf",
      confirmedRole: "lecture_notes",
      pages: [
        "Unit 2: Control Flow\nConcepts: Loops, Tracing, Debugging\nDebugging relies on tracing repeated mistakes and checking changing state.",
      ],
    });
    await uploadAndConfirmRole({
      learnerId,
      coursePackId,
      filename: "recurrence_functions.pdf",
      confirmedRole: "slides",
      pages: [
        "Unit 3: Functions\nConcepts: Functions, Parameters, Return Values\nFunctions review parameters, returns, and tracing function calls.",
      ],
    });
    await uploadAndConfirmRole({
      learnerId,
      coursePackId,
      filename: "recurrence_past_exam.pdf",
      confirmedRole: "past_exam",
      pages: [
        "Past exam review\nConcepts: Variables, Functions, Debugging, Tracing\nPast papers combine functions, tracing, and debugging in exam-style prompts.",
      ],
    });

    const extractionResponse = await request(app.getHttpServer())
      .post(`/course-packs/${coursePackId}/extraction`)
      .set("x-learner-id", learnerId);

    assert.equal(extractionResponse.status, 201);

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

    const compiledConcepts = await prisma.compiledCoachConcept.findMany({
      where: {
        compiledCoachPackId:
          activationResponse.body.compiledCoachPack.compiledCoachPackId,
      },
      orderBy: {
        sequenceOrder: "asc",
      },
    });

    const debuggingConcept =
      compiledConcepts.find((concept) => /debug/i.test(concept.displayLabel)) ?? null;
    const functionsConcept =
      compiledConcepts.find((concept) => /function/i.test(concept.displayLabel)) ?? null;

    assert.ok(debuggingConcept);
    assert.ok(functionsConcept);
    assert.ok(debuggingConcept?.engineConceptId);
    assert.ok(functionsConcept?.engineConceptId);

    const onboardingResponse = await request(app.getHttpServer())
      .post("/onboarding/complete")
      .set("x-learner-id", learnerId)
      .send({
        priorProgrammingExposure: "school_basics",
        currentComfortLevel: "low",
        biggestDifficulty: "debugging_errors",
        preferredHelpStyle: "step_breakdown",
      });

    assert.equal(onboardingResponse.status, 201);

    await ensureCompletedDiagnostic(learnerId);

    await prisma.activeCourseContext.update({
      where: {
        learnerId,
      },
      data: {
        supportLevel: "planning_review",
        focusCompiledConceptId: functionsConcept!.id,
        focusEngineConceptId: functionsConcept!.engineConceptId,
        recurringResolvedConceptId: debuggingConcept!.id,
        recurringResolvedAt: new Date("2026-04-19T08:00:00.000Z"),
      },
    });

    await prisma.learnerProgrammingPersona.update({
      where: {
        learnerId,
      },
      data: {
        focusConceptId: functionsConcept!.engineConceptId,
      },
    });

    await createCompletedFocusSession({
      learnerId,
      coursePackId,
      focusCompiledConceptId: debuggingConcept!.id,
      focusConceptId: debuggingConcept!.engineConceptId!,
      generatedAt: new Date("2026-04-19T07:00:00.000Z"),
    });
    await createCompletedFocusSession({
      learnerId,
      coursePackId,
      focusCompiledConceptId: debuggingConcept!.id,
      focusConceptId: debuggingConcept!.engineConceptId!,
      generatedAt: new Date("2026-04-18T07:00:00.000Z"),
    });

    const residueTodayResponse = await request(app.getHttpServer())
      .get("/today")
      .set("x-learner-id", learnerId);

    assert.equal(residueTodayResponse.status, 200);
    assert.equal(
      residueTodayResponse.body.recurringFocusDecision?.decisionType,
      "holding_against_recent_residue",
    );
    assert.equal(
      residueTodayResponse.body.recurringFocusDecision?.sourceLabel,
      debuggingConcept!.displayLabel,
    );

    const residueSessionResponse = await request(app.getHttpServer())
      .post("/session/create-or-resume")
      .set("x-learner-id", learnerId);

    assert.equal(residueSessionResponse.status, 201);
    assert.equal(
      residueSessionResponse.body.recurringFocusDecision?.decisionType,
      "holding_against_recent_residue",
    );

    await completeDailySession({
      learnerId,
      sessionId: residueSessionResponse.body.sessionId,
      answerMode: "all_correct",
    });

    const residueSummaryResponse = await request(app.getHttpServer())
      .get(`/session/${residueSessionResponse.body.sessionId}/summary`)
      .set("x-learner-id", learnerId);

    assert.equal(residueSummaryResponse.status, 200);
    assert.equal(
      residueSummaryResponse.body.recurringFocusDecision?.decisionType,
      "holding_against_recent_residue",
    );

    await prisma.learnerProgrammingPersona.update({
      where: {
        learnerId,
      },
      data: {
        focusConceptId: debuggingConcept!.engineConceptId,
      },
    });

    await prisma.activeCourseContext.update({
      where: {
        learnerId,
      },
      data: {
        supportLevel: "full_coach",
        focusCompiledConceptId: debuggingConcept!.id,
        focusEngineConceptId: debuggingConcept!.engineConceptId,
      },
    });

    await prisma.learnerCompiledCoachConceptState.update({
      where: {
        learnerId_coursePackId_compiledCoachConceptId: {
          learnerId,
          coursePackId,
          compiledCoachConceptId: debuggingConcept!.id,
        },
      },
      data: {
        masteryState: "emerging",
        recentErrorTag: "debugging_strategy_error",
        lastObservedAt: new Date("2026-04-19T09:00:00.000Z"),
      },
    });

    const resurfacingTodayResponse = await request(app.getHttpServer())
      .get("/today")
      .set("x-learner-id", learnerId);

    assert.equal(resurfacingTodayResponse.status, 200);
    assert.equal(
      resurfacingTodayResponse.body.recurringFocusDecision?.decisionType,
      "returning_to_resolved_area",
    );
    assert.equal(
      resurfacingTodayResponse.body.recurringFocusDecision?.sourceLabel,
      debuggingConcept!.displayLabel,
    );

    const resurfacingSessionResponse = await request(app.getHttpServer())
      .post("/session/create-or-resume")
      .set("x-learner-id", learnerId);

    assert.equal(resurfacingSessionResponse.status, 201);
    assert.equal(
      resurfacingSessionResponse.body.recurringFocusDecision?.decisionType,
      "returning_to_resolved_area",
    );

    await completeDailySession({
      learnerId,
      sessionId: resurfacingSessionResponse.body.sessionId,
      answerMode: "all_correct",
    });

    const resurfacingSummaryResponse = await request(app.getHttpServer())
      .get(`/session/${resurfacingSessionResponse.body.sessionId}/summary`)
      .set("x-learner-id", learnerId);

    assert.equal(resurfacingSummaryResponse.status, 200);
    assert.equal(
      resurfacingSummaryResponse.body.recurringFocusDecision?.decisionType,
      "returning_to_resolved_area",
    );

    const activeContext = await prisma.activeCourseContext.findUniqueOrThrow({
      where: {
        learnerId,
      },
    });

    assert.equal(activeContext.recurringResolvedConceptId, null);
    assert.equal(activeContext.recurringResolvedAt, null);
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

async function createCompletedFocusSession(input: {
  learnerId: string;
  coursePackId: string;
  focusCompiledConceptId: string;
  focusConceptId: string;
  generatedAt: Date;
}) {
  const examCycle = await prisma.examCycle.findFirstOrThrow({
    where: {
      learnerId: input.learnerId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  await prisma.session.create({
    data: {
      id: randomUUID(),
      learnerId: input.learnerId,
      examCycleId: examCycle.id,
      sessionType: "daily_practice",
      sessionMode: "steady_practice",
      focusConceptId: input.focusConceptId,
      activeCoursePackId: input.coursePackId,
      focusCompiledConceptId: input.focusCompiledConceptId,
      status: "completed",
      currentIndex: 4,
      totalItems: 4,
      checkpointToken: randomUUID(),
      generatedAt: input.generatedAt,
      startedAt: input.generatedAt,
      completedAt: new Date(input.generatedAt.getTime() + 15 * 60 * 1000),
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
