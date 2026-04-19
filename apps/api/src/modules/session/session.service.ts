import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  CoursePackSupportLevel,
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
import { CoursePackContextService } from "../course-pack/course-pack-context.service";
import { mapActiveCourseContextResponse } from "../course-pack/course-pack.mapper";
import {
  ActiveCourseContextPayload,
  RecurringFocusDecisionPayload,
  SessionRefreshHandoffPayload,
} from "../course-pack/course-pack.types";
import { COURSE_PACK_CONFIRMATION_INCLUDE } from "../course-pack/course-pack.query";
import {
  deriveCoursePackRefreshContext,
  shouldContinueRefreshFollowThrough,
} from "../course-pack/course-pack-refresh-handoff";
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
    private readonly coursePackContextService: CoursePackContextService,
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
    const refreshSequence = plan.decision.activeCourseContext?.followThrough
      ? 2
      : plan.decision.activeCourseContext?.refreshContext?.firstSessionPending
        ? 1
        : plan.decision.activeCourseContext?.resolution
          ? 3
          : null;
    const recurringFocusDecision = plan.decision.activeCourseContext
      ? await this.coursePackContextService.getRecurringFocusDecision({
          learnerId,
          currentFocusConceptId: plan.decision.focusConceptId,
          currentFocusCompiledConceptId: plan.decision.focusCompiledConceptId,
          currentFocusConceptLabel: plan.decision.focusConceptLabel,
        })
      : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.session.create({
        data: {
          id: sessionId,
          learnerId,
          examCycleId: examCycle.id,
          sessionType: SessionType.daily_practice,
          sessionMode: plan.decision.sessionMode,
          focusConceptId: plan.decision.focusConceptId,
          activeCoursePackId: plan.decision.activeCourseContext?.coursePackId ?? null,
          focusCompiledConceptId:
            plan.decision.activeCourseContext?.supportLevel ===
            CoursePackSupportLevel.full_coach
              ? plan.decision.focusCompiledConceptId
              : null,
          refreshSequence,
          recurringDecisionType: recurringFocusDecision?.decisionType ?? null,
          recurringSourceConceptId:
            recurringFocusDecision?.sourceNormalizedConceptId ?? null,
          recurringSourceConceptLabel:
            recurringFocusDecision?.sourceLabel ?? null,
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
        activeCoursePack: true,
        focusConcept: true,
        focusCompiledConcept: true,
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
    const latestActiveCourseContext = session.activeCoursePackId
      ? await this.coursePackContextService.getActiveContextPayload(
          input.learnerId,
        )
      : null;
    const activeCourseContext =
      latestActiveCourseContext &&
      latestActiveCourseContext.coursePackId === session.activeCoursePackId
        ? latestActiveCourseContext
        : this.buildSessionActiveCourseContext(session);
    const refreshHandoff =
      session.sessionType === SessionType.daily_practice
        ? await this.buildSessionRefreshHandoff({
            session: {
              activeCoursePackId: session.activeCoursePackId,
              focusCompiledConcept: session.focusCompiledConcept,
              generatedAt: session.generatedAt,
              refreshSequence: session.refreshSequence,
            },
          })
        : null;
    const recurringFocusDecision =
      session.sessionType === SessionType.daily_practice
        ? this.buildPersistedRecurringFocusDecision({
            session: {
              focusCompiledConceptId: session.focusCompiledConceptId,
              recurringDecisionType: session.recurringDecisionType,
              recurringSourceConceptId: session.recurringSourceConceptId,
              recurringSourceConceptLabel: session.recurringSourceConceptLabel,
              focusCompiledConcept: session.focusCompiledConcept,
              focusConcept: session.focusConcept,
            },
          }) ??
          (activeCourseContext
            ? await this.coursePackContextService.getRecurringFocusDecision({
                learnerId: input.learnerId,
                currentFocusConceptId: session.focusConceptId,
                currentFocusCompiledConceptId: session.focusCompiledConceptId,
                currentFocusConceptLabel:
                  session.focusCompiledConcept?.displayLabel ??
                  session.focusConcept?.learnerLabel ??
                  null,
              })
            : null)
        : null;

    if (session.sessionType === SessionType.diagnostic) {
      return {
        sessionId: session.id,
        sessionType: "diagnostic" as const,
        status: session.status,
        currentIndex: session.currentIndex,
        totalItems: session.totalItems,
        checkpointToken: session.checkpointToken,
        currentTask: baseTaskPayload,
        activeCourseContext,
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
      focusConceptLabel:
        session.focusCompiledConcept?.displayLabel ??
        session.focusConcept?.learnerLabel ??
        "",
      focusCompiledConceptId: session.focusCompiledConceptId,
      refreshHandoff,
      recurringFocusDecision,
      currentIndex: session.currentIndex,
      totalItems: session.totalItems,
      checkpointToken: session.checkpointToken,
      activeCourseContext,
      currentTask: {
        ...baseTaskPayload,
        helpAvailable: Boolean(helpTemplate),
        helpKind: helpTemplate?.helpKind ?? null,
        helpLabel: helpTemplate ? "يمكن إظهار خطوة مساعدة" : null,
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
    const completedAt =
      nextStatus === SessionStatus.completed ? new Date() : null;
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
        activeCoursePackId: session.activeCoursePackId,
        focusCompiledConceptId: session.focusCompiledConceptId,
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
          completedAt,
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

        await this.updateRefreshFollowThroughAfterSession(tx, {
          learnerId: input.learnerId,
          sessionId: session.id,
          activeCoursePackId: session.activeCoursePackId,
          refreshSequence: session.refreshSequence,
        });
        await this.updateRecurringResolutionAfterSession(tx, {
          learnerId: input.learnerId,
          activeCoursePackId: session.activeCoursePackId,
          recurringDecisionType: session.recurringDecisionType,
          recurringSourceConceptId: session.recurringSourceConceptId,
          completedAt: completedAt ?? new Date(),
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
              label: "اكشف المساعدة",
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
        activeCoursePack: true,
        focusConcept: true,
        focusCompiledConcept: true,
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

    const latestActiveCourseContext = session.activeCoursePackId
      ? await this.coursePackContextService.getActiveContextPayload(
          input.learnerId,
        )
      : null;
    const refreshHandoff = await this.buildSessionRefreshHandoff({
      session: {
        activeCoursePackId: session.activeCoursePackId,
        focusCompiledConcept: session.focusCompiledConcept,
        generatedAt: session.generatedAt,
        refreshSequence: session.refreshSequence,
      },
    });
    const recurringFocusDecision = session.activeCoursePackId
      ? this.buildPersistedRecurringFocusDecision({
          session: {
            focusCompiledConceptId: session.focusCompiledConceptId,
            recurringDecisionType: session.recurringDecisionType,
            recurringSourceConceptId: session.recurringSourceConceptId,
            recurringSourceConceptLabel: session.recurringSourceConceptLabel,
            focusCompiledConcept: session.focusCompiledConcept,
            focusConcept: session.focusConcept,
          },
        }) ??
        (await this.coursePackContextService.getRecurringFocusDecision({
          learnerId: input.learnerId,
          currentFocusConceptId: session.focusConceptId,
          currentFocusCompiledConceptId: session.focusCompiledConceptId,
          currentFocusConceptLabel:
            session.focusCompiledConcept?.displayLabel ??
            session.focusConcept?.learnerLabel ??
            null,
        }))
      : null;

    const payload = {
      sessionId: session.id,
      sessionMode: session.sessionMode,
      focusConceptId: session.focusConceptId,
      focusConceptLabel:
        session.focusCompiledConcept?.displayLabel ??
        session.focusConcept?.learnerLabel ??
        "",
      focusCompiledConceptId: session.focusCompiledConceptId,
      refreshHandoff,
      recurringFocusDecision,
      activeCourseContext:
        latestActiveCourseContext &&
        latestActiveCourseContext.coursePackId === session.activeCoursePackId
          ? latestActiveCourseContext
          : this.buildSessionActiveCourseContext(session),
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
        label: "العودة إلى حالتك البرمجية اليوم",
        text:
          (await this.curriculumService.getSummaryTemplateText({
            summaryField: "nextBestAction",
            triggerCode: "return_to_programming_state",
          })) || "ارجع إلى حالتك البرمجية اليوم لتظهر لك الخطوة الموصى بها التالية.",
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
        })) || "أصبحت إجاباتك أكثر ثباتًا في فكرة التركيز خلال هذه الجلسة."
      );
    }

    if (code === "debugging_recovery") {
      return "بعد التعثر، تمكنت من استعادة المسار ومواصلة الجلسة بهدوء.";
    }

    return "أكملت الجلسة وحافظت على تقدّمك خطوة بعد خطوة.";
  }

  private getWhatImprovedLabel(code: string) {
    if (code === "concept_strengthened") {
      return "ما الذي تحسّن";
    }

    if (code === "debugging_recovery") {
      return "ما الذي تحسّن";
    }

    return "ما الذي تحسّن";
  }

  private getWhatNeedsSupportLabel(code: string) {
    if (code === "syntax_still_fragile") {
      return "ما الذي ما زال يحتاج دعمًا";
    }

    if (code === "debugging_still_needs_structure") {
      return "ما الذي ما زال يحتاج دعمًا";
    }

    return "ما الذي ما زال يحتاج دعمًا";
  }

  private getWhatNeedsSupportText(code: string) {
    if (code === "syntax_still_fragile") {
      return "صياغة بايثون ما زالت تحتاج مرورًا أوضح في الجلسة التالية.";
    }

    if (code === "debugging_still_needs_structure") {
      return "إصلاح الأخطاء ما زال يحتاج خطوة أكثر تنظيمًا في المرة التالية.";
    }

    return "هذه الفكرة ما زالت تحتاج مرورًا أوضح في الجلسة التالية.";
  }

  private getStudyPatternLabel(code: string) {
    if (code === "recovered_after_mistake") {
      return "ما الذي لاحظناه في طريقة تقدّمك";
    }

    if (code === "hesitated_but_completed") {
      return "ما الذي لاحظناه في طريقة تقدّمك";
    }

    if (code === "needed_hint_to_progress") {
      return "ما الذي لاحظناه في طريقة تقدّمك";
    }

    return "ما الذي لاحظناه في طريقة تقدّمك";
  }

  private async getStudyPatternText(code: string) {
    if (code === "recovered_after_mistake") {
      return (
        (await this.curriculumService.getSummaryTemplateText({
          summaryField: "studyPatternObserved",
          triggerCode: code,
        })) || "واصلت العمل بعد التعثر واستعدت المسار داخل الجلسة نفسها."
      );
    }

    if (code === "hesitated_but_completed") {
      return "أكملت جلسة أخف وحافظت على حركة التقدّم دون انقطاع.";
    }

    if (code === "needed_hint_to_progress") {
      return "خطوة مساعدة منظّمة ساعدتك على متابعة التقدّم داخل هذه الجلسة.";
    }

    return "تحركت داخل هذه الجلسة بإيقاع ثابت وواضح.";
  }

  private buildSessionActiveCourseContext(session: {
    activeCoursePack: {
      id: string;
      courseTitle: string;
      supportLevelFinal: CoursePackSupportLevel | null;
      supportLevelCandidate: CoursePackSupportLevel | null;
      activatedAt: Date | null;
    } | null;
    focusCompiledConceptId: string | null;
    focusCompiledConcept: {
      displayLabel: string;
      engineConceptId: string | null;
    } | null;
  }): ActiveCourseContextPayload | null {
    if (!session.activeCoursePack) {
      return null;
    }

    return mapActiveCourseContextResponse({
      coursePackId: session.activeCoursePack.id,
      courseTitle: session.activeCoursePack.courseTitle,
      supportLevel:
        session.activeCoursePack.supportLevelFinal ??
        session.activeCoursePack.supportLevelCandidate ??
        CoursePackSupportLevel.planning_review,
      focusCompiledConceptId: session.focusCompiledConceptId,
      focusEngineConceptId: session.focusCompiledConcept?.engineConceptId ?? null,
      focusCompiledConcept: session.focusCompiledConcept,
      activatedAt: session.activeCoursePack.activatedAt ?? new Date(0),
    });
  }

  private async buildSessionRefreshHandoff(input: {
    session: {
      activeCoursePackId: string | null;
      focusCompiledConcept: {
        sourceConfirmedConceptId: string;
        displayLabel: string;
      } | null;
      generatedAt: Date;
      refreshSequence: number | null;
    };
  }): Promise<SessionRefreshHandoffPayload> {
    if (
      !input.session.activeCoursePackId ||
      input.session.refreshSequence == null
    ) {
      return null;
    }

    const activationSnapshot = await this.prisma.confirmationSnapshot.findFirst({
      where: {
        coursePackId: input.session.activeCoursePackId,
        activatedAt: {
          not: null,
          lte: input.session.generatedAt,
        },
      },
      orderBy: {
        activatedAt: "desc",
      },
      include: COURSE_PACK_CONFIRMATION_INCLUDE,
    });

    if (!activationSnapshot?.activatedAt) {
      return null;
    }

    const previousConfirmationSnapshot =
      await this.prisma.confirmationSnapshot.findFirst({
        where: {
          coursePackId: input.session.activeCoursePackId,
          createdAt: {
            lt: activationSnapshot.createdAt,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: COURSE_PACK_CONFIRMATION_INCLUDE,
      });

    const refreshContext = deriveCoursePackRefreshContext({
      currentConfirmationSnapshot: activationSnapshot,
      previousConfirmationSnapshot,
      focusCompiledConcept: input.session.focusCompiledConcept,
    });

    if (!refreshContext) {
      return null;
    }

    return {
      ...refreshContext,
      isFirstSessionAfterRefresh: input.session.refreshSequence === 1,
      isFollowThroughSession: input.session.refreshSequence === 2,
      isResolutionSession: input.session.refreshSequence === 3,
    };
  }

  private buildPersistedRecurringFocusDecision(input: {
    session: {
      focusCompiledConceptId: string | null;
      recurringDecisionType: string | null;
      recurringSourceConceptId: string | null;
      recurringSourceConceptLabel: string | null;
      focusCompiledConcept: {
        displayLabel: string;
      } | null;
      focusConcept: {
        learnerLabel: string;
      } | null;
    };
  }): RecurringFocusDecisionPayload | null {
    if (
      !input.session.recurringDecisionType ||
      !input.session.recurringSourceConceptLabel
    ) {
      return null;
    }

    const currentFocusLabel =
      input.session.focusCompiledConcept?.displayLabel ??
      input.session.focusConcept?.learnerLabel ??
      "";

    if (!currentFocusLabel) {
      return null;
    }

    return {
      decisionType:
        input.session
          .recurringDecisionType as RecurringFocusDecisionPayload["decisionType"],
      currentFocusNormalizedConceptId: input.session.focusCompiledConceptId,
      currentFocusLabel,
      sourceNormalizedConceptId: input.session.recurringSourceConceptId,
      sourceLabel: input.session.recurringSourceConceptLabel,
      repeatCount: null,
      reasonCode: this.getReasonCodeForRecurringDecision(
        input.session
          .recurringDecisionType as RecurringFocusDecisionPayload["decisionType"],
      ),
      nextStepIntent: this.getNextStepIntentForRecurringDecision(
        input.session
          .recurringDecisionType as RecurringFocusDecisionPayload["decisionType"],
      ),
    };
  }

  private getReasonCodeForRecurringDecision(
    decisionType: RecurringFocusDecisionPayload["decisionType"],
  ): RecurringFocusDecisionPayload["reasonCode"] {
    switch (decisionType) {
      case "escalating_recurring_area":
        return "recent_support_signal";
      case "rotating_after_stabilization":
        return "area_stabilized";
      case "returning_to_resolved_area":
        return "genuine_resurfacing";
      case "holding_against_recent_residue":
        return "recent_memory_residue";
      case "rotating_from_recurring_area":
      case "staying_with_recurring_area":
      default:
        return "repeat_focus";
    }
  }

  private getNextStepIntentForRecurringDecision(
    decisionType: RecurringFocusDecisionPayload["decisionType"],
  ): RecurringFocusDecisionPayload["nextStepIntent"] {
    if (
      decisionType === "staying_with_recurring_area" ||
      decisionType === "escalating_recurring_area" ||
      decisionType === "returning_to_resolved_area"
    ) {
      return "stay";
    }

    return "move_on";
  }

  private async updateRefreshFollowThroughAfterSession(
    tx: Prisma.TransactionClient,
    input: {
      learnerId: string;
      sessionId: string;
      activeCoursePackId: string | null;
      refreshSequence: number | null;
    },
  ) {
    if (!input.activeCoursePackId || input.refreshSequence == null) {
      return;
    }

    const activeContext = await tx.activeCourseContext.findUnique({
      where: {
        learnerId: input.learnerId,
      },
    });

    if (!activeContext || activeContext.coursePackId !== input.activeCoursePackId) {
      return;
    }

    if (
      input.refreshSequence == null &&
      activeContext.refreshResolvedConceptId != null
    ) {
      await tx.activeCourseContext.update({
        where: {
          learnerId: input.learnerId,
        },
        data: {
          refreshResolvedConceptId: null,
        },
      });
      return;
    }

    if (input.refreshSequence === 3) {
      await tx.activeCourseContext.update({
        where: {
          learnerId: input.learnerId,
        },
        data: {
          refreshResolvedConceptId: null,
        },
      });
      return;
    }

    if (input.refreshSequence === 2) {
      await tx.activeCourseContext.update({
        where: {
          learnerId: input.learnerId,
        },
        data: {
          refreshFollowThroughConceptId: null,
          refreshResolvedConceptId: activeContext.focusCompiledConceptId,
        },
      });
      return;
    }

    const followThroughConceptId = activeContext.focusCompiledConceptId;

    if (!followThroughConceptId) {
      return;
    }

    const [compiledConceptState, incorrectCount] = await Promise.all([
      tx.learnerCompiledCoachConceptState.findUnique({
        where: {
          learnerId_coursePackId_compiledCoachConceptId: {
            learnerId: input.learnerId,
            coursePackId: input.activeCoursePackId,
            compiledCoachConceptId: followThroughConceptId,
          },
        },
      }),
      tx.attempt.count({
        where: {
          learnerId: input.learnerId,
          sessionId: input.sessionId,
          isCorrect: false,
        },
      }),
    ]);

    const shouldKeepFollowThrough = shouldContinueRefreshFollowThrough({
      compiledConceptState,
      incorrectCount,
    });

    await tx.activeCourseContext.update({
      where: {
        learnerId: input.learnerId,
      },
      data: {
        refreshFollowThroughConceptId: shouldKeepFollowThrough
          ? followThroughConceptId
          : null,
        refreshResolvedConceptId: shouldKeepFollowThrough
          ? null
          : followThroughConceptId,
      },
    });
  }

  private async updateRecurringResolutionAfterSession(
    tx: Prisma.TransactionClient,
    input: {
      learnerId: string;
      activeCoursePackId: string | null;
      recurringDecisionType: string | null;
      recurringSourceConceptId: string | null;
      completedAt: Date;
    },
  ) {
    if (!input.activeCoursePackId || !input.recurringDecisionType) {
      return;
    }

    const activeContext = await tx.activeCourseContext.findUnique({
      where: {
        learnerId: input.learnerId,
      },
    });

    if (!activeContext || activeContext.coursePackId !== input.activeCoursePackId) {
      return;
    }

    if (input.recurringDecisionType === "returning_to_resolved_area") {
      await tx.activeCourseContext.update({
        where: {
          learnerId: input.learnerId,
        },
        data: {
          recurringResolvedConceptId: null,
          recurringResolvedAt: null,
        },
      });
      return;
    }

    if (
      !input.recurringSourceConceptId ||
      ![
        "rotating_from_recurring_area",
        "rotating_after_stabilization",
      ].includes(input.recurringDecisionType)
    ) {
      return;
    }

    await tx.activeCourseContext.update({
      where: {
        learnerId: input.learnerId,
      },
      data: {
        recurringResolvedConceptId: input.recurringSourceConceptId,
        recurringResolvedAt: input.completedAt,
      },
    });
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
      steady_practice: "تدريب ثابت",
      concept_repair: "تقوية الفكرة",
      debugging_drill: "تدريب على الإصلاح",
      recovery_mode: "عودة هادئة",
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
