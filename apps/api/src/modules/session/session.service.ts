import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  FeedbackType,
  HelpKind,
  LearnerProgressState,
  Prisma,
  ProgrammingErrorTag,
  SessionMode,
  SessionStatus,
  SessionType,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CurriculumService } from "../curriculum/curriculum.service";
import { LearnerProgressService } from "../learner/learner-progress.service";
import { ProgrammingPlannerService } from "../learner/programming-planner.service";
import { TelemetryService } from "../telemetry/telemetry.service";
import { deriveProgrammingSummaryCodes } from "./programming-summary.util";

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumService: CurriculumService,
    private readonly learnerProgressService: LearnerProgressService,
    private readonly programmingPlannerService: ProgrammingPlannerService,
    private readonly telemetryService: TelemetryService,
  ) {}

  async createOrResumeDiagnostic(learnerId: string) {
    const examCycle = await this.getActiveExamCycle(learnerId);

    if (!examCycle) {
      throw new BadRequestException("Onboarding incomplete");
    }

    const activeSession = await this.prisma.session.findFirst({
      where: {
        learnerId,
        examCycleId: examCycle.id,
        sessionType: SessionType.diagnostic,
        status: {
          in: [SessionStatus.generated, SessionStatus.in_progress],
        },
      },
      orderBy: {
        generatedAt: "desc",
      },
    });

    if (activeSession) {
      if (activeSession.status === SessionStatus.generated) {
        await this.prisma.session.update({
          where: { id: activeSession.id },
          data: {
            status: SessionStatus.in_progress,
            startedAt: activeSession.startedAt ?? new Date(),
          },
        });
      }

      return this.getSessionPayload({
        learnerId,
        sessionId: activeSession.id,
      });
    }

    const completedDiagnostic = await this.prisma.session.findFirst({
      where: {
        learnerId,
        examCycleId: examCycle.id,
        sessionType: SessionType.diagnostic,
        status: SessionStatus.completed,
      },
      select: { id: true },
    });

    if (completedDiagnostic) {
      throw new ConflictException("Diagnostic completed");
    }

    const diagnosticTasks = await this.curriculumService.getDiagnosticTasks();

    if (diagnosticTasks.length !== 6) {
      throw new BadRequestException("Diagnostic fixture count invalid");
    }

    const sessionId = randomUUID();
    const checkpointToken = this.createCheckpointToken();

    await this.prisma.$transaction(async (tx) => {
      await tx.session.create({
        data: {
          id: sessionId,
          learnerId,
          examCycleId: examCycle.id,
          sessionType: SessionType.diagnostic,
          status: SessionStatus.in_progress,
          currentIndex: 1,
          totalItems: diagnosticTasks.length,
          checkpointToken,
          startedAt: new Date(),
        },
      });

      await tx.sessionItem.createMany({
        data: diagnosticTasks.map((task, index) => ({
          id: randomUUID(),
          sessionId,
          questionItemId: task.id,
          sequenceOrder: index + 1,
          slotType: "diagnostic_task",
          isFollowup: false,
        })),
      });

      await tx.examCycle.update({
        where: { id: examCycle.id },
        data: {
          progressState: LearnerProgressState.diagnostic_in_progress,
        },
      });
    });

    await this.learnerProgressService.markSessionStarted(learnerId);
    await this.telemetryService.recordEvent({
      eventName: "tc_diagnostic_started",
      learnerId,
      route: "/diagnostic",
      sessionId,
      properties: {
        sessionId,
        sessionType: "diagnostic",
      },
    });

    return this.getSessionPayload({
      learnerId,
      sessionId,
    });
  }

  async createOrResumeDailySession(learnerId: string) {
    const examCycle = await this.getActiveExamCycle(learnerId);

    if (!examCycle) {
      throw new BadRequestException("Onboarding incomplete");
    }

    const completedDiagnostic = await this.prisma.session.findFirst({
      where: {
        learnerId,
        examCycleId: examCycle.id,
        sessionType: SessionType.diagnostic,
        status: SessionStatus.completed,
      },
      select: { id: true },
    });

    if (!completedDiagnostic) {
      throw new BadRequestException("Diagnostic incomplete");
    }

    const activeSession = await this.prisma.session.findFirst({
      where: {
        learnerId,
        examCycleId: examCycle.id,
        sessionType: SessionType.daily_practice,
        status: {
          in: [SessionStatus.generated, SessionStatus.in_progress],
        },
      },
      orderBy: {
        generatedAt: "desc",
      },
    });

    if (activeSession) {
      if (activeSession.status === SessionStatus.generated) {
        await this.prisma.session.update({
          where: { id: activeSession.id },
          data: {
            status: SessionStatus.in_progress,
            startedAt: activeSession.startedAt ?? new Date(),
          },
        });
      }

      await this.learnerProgressService.markSessionResumed(learnerId);
      await this.telemetryService.recordEvent({
        eventName: "tc_session_resumed",
        learnerId,
        route: "/today",
        sessionId: activeSession.id,
        properties: {
          sessionId: activeSession.id,
          resumeSource: "today",
        },
      });

      return this.getSessionPayload({
        learnerId,
        sessionId: activeSession.id,
      });
    }

    const plan = await this.programmingPlannerService.buildDailySessionPlan(
      learnerId,
    );

    if (plan.tasks.length === 0) {
      throw new BadRequestException("No daily session items available");
    }

    const sessionId = randomUUID();
    const checkpointToken = this.createCheckpointToken();

    await this.prisma.$transaction(async (tx) => {
      await tx.session.create({
        data: {
          id: sessionId,
          learnerId,
          examCycleId: examCycle.id,
          sessionType: SessionType.daily_practice,
          sessionMode: plan.decision.sessionMode,
          focusConceptId: plan.decision.focusConceptId,
          rationaleCode: plan.decision.rationaleCode,
          status: SessionStatus.in_progress,
          currentIndex: 1,
          totalItems: plan.tasks.length,
          checkpointToken,
          startedAt: new Date(),
        },
      });

      await tx.sessionItem.createMany({
        data: plan.tasks.map((task, index) => ({
          id: randomUUID(),
          sessionId,
          questionItemId: task.id,
          sequenceOrder: index + 1,
          slotType: task.taskType,
          isFollowup: false,
        })),
      });
    });

    await this.learnerProgressService.markSessionStarted(learnerId);
    await this.telemetryService.recordEvent({
      eventName: "tc_session_started",
      learnerId,
      route: "/today",
      sessionId,
      properties: {
        sessionId,
        sessionMode: plan.decision.sessionMode,
        focusConceptId: plan.decision.focusConceptId,
        totalItems: plan.tasks.length,
      },
    });

    return this.getSessionPayload({
      learnerId,
      sessionId,
    });
  }

  async getSessionPayload(input: { learnerId: string; sessionId: string }) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: input.sessionId,
        learnerId: input.learnerId,
      },
      include: {
        focusConcept: true,
        sessionItems: {
          orderBy: {
            sequenceOrder: "asc",
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (session.status === SessionStatus.completed) {
      throw new ConflictException("Session completed");
    }

    const currentSessionItem = session.sessionItems.find(
      (item) => item.sequenceOrder === session.currentIndex,
    );

    if (!currentSessionItem) {
      throw new NotFoundException("Current item not found");
    }

    const taskMap = await this.curriculumService.getTasksByIds(
      session.sessionItems.map((item) => item.questionItemId),
    );
    const currentTask = taskMap.get(currentSessionItem.questionItemId);

    if (!currentTask) {
      throw new NotFoundException("Programming task not found");
    }

    const baseTaskPayload = {
      sessionItemId: currentSessionItem.id,
      taskId: currentTask.id,
      conceptId: currentTask.conceptId,
      taskType: currentTask.taskType,
      prompt: currentTask.prompt,
      codeSnippet: currentTask.codeSnippet,
      choices: this.readChoiceObjects(currentTask.choices),
      answerFormat: currentTask.answerFormat,
      helperText: currentTask.helperText,
    };

    if (session.sessionType === SessionType.diagnostic) {
      return {
        sessionId: session.id,
        sessionType: "diagnostic" as const,
        status: session.status,
        currentIndex: session.currentIndex,
        totalItems: session.totalItems,
        checkpointToken: session.checkpointToken,
        currentTask: baseTaskPayload,
      };
    }

    const persona = await this.learnerProgressService.getPersonaSnapshot(
      input.learnerId,
    );
    const helpTemplate = await this.curriculumService.selectHelpTemplate({
      taskType: currentTask.taskType,
      sessionMode: session.sessionMode ?? SessionMode.steady_practice,
      preferredHelpStyle:
        persona.persona?.preferredHelpStyle ??
        currentTask.hintTemplate?.helpKind ??
        HelpKind.step_breakdown,
      fallbackHintTemplateId: currentTask.hintTemplateId,
    });

    return {
      sessionId: session.id,
      sessionType: "daily_practice" as const,
      status: session.status,
      sessionMode: session.sessionMode,
      sessionModeLabel: this.getSessionModeLabel(
        session.sessionMode ?? SessionMode.steady_practice,
      ),
      focusConceptId: session.focusConceptId,
      focusConceptLabel: session.focusConcept?.learnerLabel ?? "",
      currentIndex: session.currentIndex,
      totalItems: session.totalItems,
      checkpointToken: session.checkpointToken,
      currentTask: {
        ...baseTaskPayload,
        helpAvailable: Boolean(helpTemplate),
        helpKind: helpTemplate?.helpKind ?? null,
        helpLabel: helpTemplate ? "Need a hint?" : null,
      },
    };
  }

  async submitAnswer(input: {
    learnerId: string;
    sessionId: string;
    sessionItemId: string;
    answerValue: string;
    checkpointToken: string;
  }) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: input.sessionId,
        learnerId: input.learnerId,
      },
      include: {
        sessionItems: {
          orderBy: {
            sequenceOrder: "asc",
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException("Invalid session");
    }

    if (session.status === SessionStatus.completed) {
      throw new ConflictException("Session completed");
    }

    const currentSessionItem = session.sessionItems.find(
      (item) => item.sequenceOrder === session.currentIndex,
    );

    if (!currentSessionItem) {
      throw new ConflictException("Current session item missing");
    }

    if (input.sessionItemId !== currentSessionItem.id) {
      const submittedItemAttempt = await this.prisma.attempt.findFirst({
        where: {
          learnerId: input.learnerId,
          sessionId: input.sessionId,
          sessionItemId: input.sessionItemId,
        },
      });

      if (submittedItemAttempt) {
        throw new ConflictException("Duplicate submit");
      }

      throw new ConflictException("Session item mismatch");
    }

    if (input.checkpointToken !== session.checkpointToken) {
      const existingAttempt = await this.prisma.attempt.findFirst({
        where: {
          learnerId: input.learnerId,
          sessionId: input.sessionId,
          sessionItemId: currentSessionItem.id,
        },
      });

      if (existingAttempt) {
        throw new ConflictException("Duplicate submit");
      }

      throw new ConflictException("Stale submit");
    }

    const alreadyAnswered = await this.prisma.attempt.findFirst({
      where: {
        learnerId: input.learnerId,
        sessionId: input.sessionId,
        sessionItemId: currentSessionItem.id,
      },
    });

    if (alreadyAnswered) {
      throw new ConflictException("Duplicate submit");
    }

    const task = await this.curriculumService.getTaskById(
      currentSessionItem.questionItemId,
    );

    if (!task) {
      throw new NotFoundException("Programming task not found");
    }

    const isCorrect = this.evaluateAnswer({
      answerFormat: task.answerFormat,
      providedAnswer: input.answerValue,
      correctAnswer: task.correctAnswer,
    });
    const primaryErrorTag = isCorrect ? null : this.resolvePrimaryErrorTag(task);
    const feedbackType = isCorrect
      ? FeedbackType.correct
      : (task.feedbackTemplate?.feedbackType ??
        this.getFallbackFeedbackType(task.taskType));

    const helpTemplate =
      session.sessionType === SessionType.daily_practice && !isCorrect
        ? await this.resolveHelpTemplate({
            learnerId: input.learnerId,
            task,
            sessionMode: session.sessionMode ?? SessionMode.steady_practice,
          })
        : null;

    const nextStatus =
      session.currentIndex >= session.totalItems
        ? SessionStatus.completed
        : SessionStatus.in_progress;
    const nextCheckpointToken =
      nextStatus === SessionStatus.completed
        ? session.checkpointToken
        : this.createCheckpointToken();
    const hadPreviousIncorrectInSession = Boolean(
      await this.prisma.attempt.findFirst({
        where: {
          learnerId: input.learnerId,
          sessionId: input.sessionId,
          isCorrect: false,
        },
      }),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.attempt.create({
        data: {
          learnerId: input.learnerId,
          sessionId: input.sessionId,
          sessionItemId: currentSessionItem.id,
          questionItemId: task.id,
          answerValue: input.answerValue,
          isCorrect,
          answerOutcome: isCorrect ? "correct" : "incorrect",
          attemptIndex: 1,
          primaryErrorTag,
          helpKindUsed: null,
        },
      });

      await this.learnerProgressService.recordProgrammingAttemptOutcome(tx, {
        learnerId: input.learnerId,
        sessionId: session.id,
        conceptId: task.conceptId,
        taskType: task.taskType,
        supportedErrorTags: task.supportedErrorTags,
        isCorrect,
        primaryErrorTag,
        sessionMode: session.sessionMode,
      });

      await tx.session.update({
        where: {
          id: session.id,
        },
        data: {
          status: nextStatus,
          currentIndex:
            nextStatus === SessionStatus.completed
              ? session.currentIndex
              : session.currentIndex + 1,
          checkpointToken: nextCheckpointToken,
          completedAt:
            nextStatus === SessionStatus.completed ? new Date() : null,
        },
      });

      if (nextStatus === SessionStatus.completed) {
        await tx.examCycle.update({
          where: { id: session.examCycleId },
          data: {
            progressState: LearnerProgressState.today_available,
          },
        });

        await this.learnerProgressService.markSessionCompleted(tx, {
          learnerId: input.learnerId,
          completedWithRecovery: hadPreviousIncorrectInSession || !isCorrect,
        });
      }
    });

    if (
      nextStatus === SessionStatus.completed &&
      session.sessionType === SessionType.daily_practice
    ) {
      const [correctCount, totalAttemptCount] = await Promise.all([
        this.prisma.attempt.count({
          where: {
            learnerId: input.learnerId,
            sessionId: session.id,
            isCorrect: true,
          },
        }),
        this.prisma.attempt.count({
          where: {
            learnerId: input.learnerId,
            sessionId: session.id,
          },
        }),
      ]);

      await this.telemetryService.recordEvent({
        eventName: "tc_session_completed",
        learnerId: input.learnerId,
        route: `/session/${session.id}/summary`,
        sessionId: session.id,
        properties: {
          sessionId: session.id,
          sessionMode: session.sessionMode ?? SessionMode.steady_practice,
          focusConceptId: session.focusConceptId ?? "",
          completedTaskCount: session.totalItems,
          correctCount,
          incorrectCount: totalAttemptCount - correctCount,
        },
      });
    }

    const response = {
      isCorrect,
      feedbackType,
      feedbackText: this.curriculumService.getFeedbackText({
        feedbackType,
        templateText: task.feedbackTemplate?.templateText ?? null,
      }),
      sessionStatus: nextStatus,
      ...(helpTemplate
        ? {
            helpOffer: {
              helpKind: helpTemplate.helpKind,
              label: "Show hint",
              text: helpTemplate.templateText,
            },
          }
        : {}),
    };

    return response;
  }

  async getSessionSummary(input: { learnerId: string; sessionId: string }) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: input.sessionId,
        learnerId: input.learnerId,
      },
      include: {
        focusConcept: true,
        attempts: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (session.status !== SessionStatus.completed) {
      throw new ConflictException("Session incomplete");
    }

    const summaryCodes = deriveProgrammingSummaryCodes({
      sessionMode: session.sessionMode,
      totalItems: session.totalItems,
      attempts: session.attempts,
    });

    const payload = {
      sessionId: session.id,
      sessionMode: session.sessionMode,
      focusConceptId: session.focusConceptId,
      focusConceptLabel: session.focusConcept?.learnerLabel ?? "",
      completedTaskCount: session.totalItems,
      correctCount: summaryCodes.correctCount,
      incorrectCount: summaryCodes.incorrectCount,
      whatImproved: {
        code: summaryCodes.whatImprovedCode,
        label: this.getWhatImprovedLabel(summaryCodes.whatImprovedCode),
        text: await this.getWhatImprovedText(summaryCodes.whatImprovedCode),
      },
      whatNeedsSupport: {
        code: summaryCodes.whatNeedsSupportCode,
        conceptId: session.focusConceptId ?? "",
        label: this.getWhatNeedsSupportLabel(summaryCodes.whatNeedsSupportCode),
        text: this.getWhatNeedsSupportText(summaryCodes.whatNeedsSupportCode),
      },
      studyPatternObserved: {
        code: summaryCodes.studyPatternCode,
        label: this.getStudyPatternLabel(summaryCodes.studyPatternCode),
        text: await this.getStudyPatternText(summaryCodes.studyPatternCode),
      },
      nextBestAction: {
        route: "/today",
        label: "Back to Your Programming State",
        text:
          (await this.curriculumService.getSummaryTemplateText({
            summaryField: "nextBestAction",
            triggerCode: "return_to_programming_state",
          })) || "Go back to Your Programming State for the next recommended step.",
      },
    };

    await this.telemetryService.recordEvent({
      eventName: "tc_summary_viewed",
      learnerId: input.learnerId,
      route: `/session/${session.id}/summary`,
      sessionId: session.id,
      properties: {
        sessionId: session.id,
        sessionMode: session.sessionMode ?? SessionMode.steady_practice,
        focusConceptId: session.focusConceptId ?? "",
      },
    });

    return payload;
  }

  private async resolveHelpTemplate(input: {
    learnerId: string;
    task: Awaited<ReturnType<CurriculumService["getTaskById"]>>;
    sessionMode: SessionMode;
  }) {
    const persona = await this.learnerProgressService.getPersonaSnapshot(
      input.learnerId,
    );

    return this.curriculumService.selectHelpTemplate({
      taskType: input.task?.taskType ?? "",
      sessionMode: input.sessionMode,
      preferredHelpStyle:
        persona.persona?.preferredHelpStyle ??
        input.task?.hintTemplate?.helpKind ??
        HelpKind.step_breakdown,
      fallbackHintTemplateId: input.task?.hintTemplateId,
    });
  }

  private async getWhatImprovedText(code: string) {
    if (code === "concept_strengthened") {
      return (
        (await this.curriculumService.getSummaryTemplateText({
          summaryField: "whatImproved",
          triggerCode: code,
        })) || "You answered more reliably on the focus concept in this session."
      );
    }

    if (code === "debugging_recovery") {
      return "You recovered after a mistake and kept moving through the session.";
    }

    return "You completed the session and kept your work moving forward.";
  }

  private getWhatImprovedLabel(code: string) {
    if (code === "concept_strengthened") {
      return "Concept strengthened";
    }

    if (code === "debugging_recovery") {
      return "Debugging recovery";
    }

    return "Steady completion";
  }

  private getWhatNeedsSupportLabel(code: string) {
    if (code === "syntax_still_fragile") {
      return "Syntax still needs support";
    }

    if (code === "debugging_still_needs_structure") {
      return "Debugging still needs structure";
    }

    return "Concept still needs support";
  }

  private getWhatNeedsSupportText(code: string) {
    if (code === "syntax_still_fragile") {
      return "Syntax-form mistakes still need a steadier pass in the next session.";
    }

    if (code === "debugging_still_needs_structure") {
      return "Debugging still needs a more structured next step.";
    }

    return "This concept still needs one steadier pass in the next session.";
  }

  private getStudyPatternLabel(code: string) {
    if (code === "recovered_after_mistake") {
      return "Recovered after mistake";
    }

    if (code === "hesitated_but_completed") {
      return "Completed after recovery";
    }

    if (code === "needed_hint_to_progress") {
      return "Hint supported progress";
    }

    return "Steady throughout";
  }

  private async getStudyPatternText(code: string) {
    if (code === "recovered_after_mistake") {
      return (
        (await this.curriculumService.getSummaryTemplateText({
          summaryField: "studyPatternObserved",
          triggerCode: code,
        })) || "You kept going after a mistake and recovered within the same session."
      );
    }

    if (code === "hesitated_but_completed") {
      return "You completed a lighter recovery session and kept your work moving.";
    }

    if (code === "needed_hint_to_progress") {
      return "A structured hint helped you move forward in this session.";
    }

    return "You moved through this session with steady momentum.";
  }

  private evaluateAnswer(input: {
    answerFormat: string;
    providedAnswer: string;
    correctAnswer: string;
  }) {
    if (input.answerFormat === "short_text") {
      return (
        this.normalizeShortText(input.providedAnswer) ===
        this.normalizeShortText(input.correctAnswer)
      );
    }

    return input.providedAnswer.trim() === input.correctAnswer.trim();
  }

  private normalizeShortText(value: string) {
    return value.trim().replace(/\s+/g, " ");
  }

  private resolvePrimaryErrorTag(task: {
    taskType: string;
    supportedErrorTags: Prisma.JsonValue;
  }) {
    const supportedTags = this.readErrorTags(task.supportedErrorTags);

    if (supportedTags.length === 0) {
      return null;
    }

    if (supportedTags.length === 1) {
      return supportedTags[0];
    }

    if (
      task.taskType === "bug_spotting" &&
      supportedTags.includes(ProgrammingErrorTag.debugging_strategy_error)
    ) {
      return ProgrammingErrorTag.debugging_strategy_error;
    }

    if (
      task.taskType === "code_completion" &&
      supportedTags.includes(ProgrammingErrorTag.syntax_form_error)
    ) {
      return ProgrammingErrorTag.syntax_form_error;
    }

    if (
      task.taskType === "trace_reasoning" ||
      task.taskType === "output_prediction"
    ) {
      const traceErrorTag =
        supportedTags.find(
          (tag) =>
            tag === ProgrammingErrorTag.value_tracking_error ||
            tag === ProgrammingErrorTag.loop_control_error ||
            tag === ProgrammingErrorTag.branch_logic_error,
        ) ?? null;

      return traceErrorTag;
    }

    return supportedTags[0] ?? null;
  }

  private getFallbackFeedbackType(taskType: string) {
    if (taskType === "trace_reasoning") {
      return FeedbackType.needs_another_check;
    }

    if (taskType === "bug_spotting" || taskType === "code_completion") {
      return FeedbackType.try_fix;
    }

    return FeedbackType.needs_review;
  }

  private getSessionModeLabel(mode: SessionMode) {
    const labels: Record<SessionMode, string> = {
      steady_practice: "Steady practice",
      concept_repair: "Concept repair",
      debugging_drill: "Debugging drill",
      recovery_mode: "Recovery mode",
    };

    return labels[mode];
  }

  private createCheckpointToken() {
    return randomUUID();
  }

  private async getActiveExamCycle(learnerId: string) {
    const profile = await this.prisma.programmingProfile.findUnique({
      where: { learnerId },
    });

    if (!profile?.onboardingComplete) {
      return null;
    }

    return this.prisma.examCycle.findFirst({
      where: {
        learnerId,
        onboardingComplete: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  private readChoiceObjects(choices: Prisma.JsonValue) {
    if (!Array.isArray(choices)) {
      return [];
    }

    return choices.filter(
      (choice): choice is { choiceId: string; label: string } =>
        Boolean(
          choice &&
            typeof choice === "object" &&
            "choiceId" in choice &&
            "label" in choice,
        ),
    );
  }

  private readErrorTags(input: Prisma.JsonValue) {
    if (!Array.isArray(input)) {
      return [];
    }

    return input.filter(
      (value): value is ProgrammingErrorTag =>
        typeof value === "string" &&
        Object.values(ProgrammingErrorTag).includes(value as ProgrammingErrorTag),
    );
  }
}
