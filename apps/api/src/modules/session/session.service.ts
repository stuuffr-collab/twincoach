import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  FeedbackType,
  LearnerProgressState,
  Prisma,
  SessionStatus,
  SessionType,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CurriculumService } from "../curriculum/curriculum.service";
import { LearnerProgressService } from "../learner/learner-progress.service";

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumService: CurriculumService,
    private readonly learnerProgressService: LearnerProgressService,
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
      this.logger.log(
        JSON.stringify({
          event: "diagnostic_session_resumed",
          learnerId,
          sessionId: activeSession.id,
        }),
      );

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
      select: {
        id: true,
      },
    });

    if (completedDiagnostic) {
      throw new ConflictException("Diagnostic completed");
    }

    const diagnosticItems = this.curriculumService.getDiagnosticItems();

    if (diagnosticItems.length === 0) {
      throw new BadRequestException("No diagnostic items available");
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
          totalItems: diagnosticItems.length,
          checkpointToken,
          startedAt: new Date(),
        },
      });

      await tx.sessionItem.createMany({
        data: diagnosticItems.map((item, index) => ({
          id: randomUUID(),
          sessionId,
          questionItemId: item.questionItemId,
          sequenceOrder: index + 1,
          slotType: item.role,
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

    this.logger.log(
      JSON.stringify({
        event: "diagnostic_session_created",
        learnerId,
        sessionId,
        totalItems: diagnosticItems.length,
      }),
    );

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

    const hasCompletedDiagnostic = await this.prisma.session.findFirst({
      where: {
        learnerId,
        examCycleId: examCycle.id,
        sessionType: SessionType.diagnostic,
        status: SessionStatus.completed,
      },
      select: {
        id: true,
      },
    });

    if (!hasCompletedDiagnostic) {
      throw new BadRequestException("Diagnostic incomplete");
    }

    const activeSession = await this.prisma.session.findFirst({
      where: {
        learnerId,
        examCycleId: examCycle.id,
        sessionType: SessionType.daily,
        status: {
          in: [SessionStatus.generated, SessionStatus.in_progress],
        },
      },
      orderBy: {
        generatedAt: "desc",
      },
    });

    if (activeSession) {
      this.logger.log(
        JSON.stringify({
          event: "daily_session_resumed",
          learnerId,
          sessionId: activeSession.id,
        }),
      );

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

    const dailyItems = await this.learnerProgressService.buildDailySessionPlan(
      learnerId,
    );

    if (dailyItems.length === 0) {
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
          sessionType: SessionType.daily,
          status: SessionStatus.in_progress,
          currentIndex: 1,
          totalItems: dailyItems.length,
          checkpointToken,
          startedAt: new Date(),
        },
      });

      await tx.sessionItem.createMany({
        data: dailyItems.map((item, index) => ({
          id: randomUUID(),
          sessionId,
          questionItemId: item.questionItemId,
          sequenceOrder: index + 1,
          slotType: item.slotType,
          isFollowup: false,
        })),
      });
    });

    this.logger.log(
      JSON.stringify({
        event: "daily_session_created",
        learnerId,
        sessionId,
        totalItems: dailyItems.length,
      }),
    );

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
        sessionItems: {
          orderBy: {
            sequenceOrder: "asc",
          },
          include: {
            questionItem: true,
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

    return {
      sessionId: session.id,
      status: session.status,
      currentIndex: session.currentIndex,
      totalItems: session.totalItems,
      checkpointToken: session.checkpointToken,
      currentItem: {
        sessionItemId: currentSessionItem.id,
        questionItemId: currentSessionItem.questionItem.id,
        topicId: currentSessionItem.questionItem.topicId,
        questionType: currentSessionItem.questionItem.questionType,
        stem: currentSessionItem.questionItem.stem,
        choices: this.readChoices(currentSessionItem.questionItem.choices),
        inputMode: currentSessionItem.questionItem.inputMode,
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
          include: {
            questionItem: true,
          },
        },
      },
    });

    if (!session) {
      this.logger.warn(
        JSON.stringify({
          event: "answer_submit_invalid_session",
          learnerId: input.learnerId,
          sessionId: input.sessionId,
        }),
      );
      throw new NotFoundException("Invalid session");
    }

    if (session.status === SessionStatus.completed) {
      this.logger.warn(
        JSON.stringify({
          event: "answer_submit_completed_session",
          learnerId: input.learnerId,
          sessionId: input.sessionId,
        }),
      );
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
        this.logger.warn(
          JSON.stringify({
            event: "answer_submit_duplicate_session_item",
            learnerId: input.learnerId,
            sessionId: input.sessionId,
            sessionItemId: input.sessionItemId,
          }),
        );
        throw new ConflictException("Duplicate submit");
      }

      this.logger.warn(
        JSON.stringify({
          event: "answer_submit_session_item_mismatch",
          learnerId: input.learnerId,
          sessionId: input.sessionId,
          sessionItemId: input.sessionItemId,
          expectedSessionItemId: currentSessionItem.id,
        }),
      );
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
        this.logger.warn(
          JSON.stringify({
            event: "answer_submit_duplicate_checkpoint",
            learnerId: input.learnerId,
            sessionId: input.sessionId,
            sessionItemId: currentSessionItem.id,
          }),
        );
        throw new ConflictException("Duplicate submit");
      }

      this.logger.warn(
        JSON.stringify({
          event: "answer_submit_stale_checkpoint",
          learnerId: input.learnerId,
          sessionId: input.sessionId,
          sessionItemId: currentSessionItem.id,
        }),
      );
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
      this.logger.warn(
        JSON.stringify({
          event: "answer_submit_duplicate_confirmed_item",
          learnerId: input.learnerId,
          sessionId: input.sessionId,
          sessionItemId: currentSessionItem.id,
        }),
      );
      throw new ConflictException("Duplicate submit");
    }

    const normalizedAnswer = input.answerValue.trim();
    const correctAnswer = currentSessionItem.questionItem.correctAnswer.trim();
    const isCorrect = normalizedAnswer === correctAnswer;
    const feedbackType = isCorrect
      ? FeedbackType.correct
      : currentSessionItem.questionItem.supportedFeedbackType;

    const nextStatus =
      session.currentIndex >= session.totalItems
        ? SessionStatus.completed
        : SessionStatus.in_progress;

    const nextCheckpointToken =
      nextStatus === SessionStatus.completed
        ? session.checkpointToken
        : this.createCheckpointToken();

    await this.prisma.$transaction(async (tx) => {
      await tx.attempt.create({
        data: {
          learnerId: input.learnerId,
          sessionId: input.sessionId,
          sessionItemId: currentSessionItem.id,
          questionItemId: currentSessionItem.questionItem.id,
          answerOutcome: isCorrect ? "correct" : "incorrect",
          attemptIndex: 1,
        },
      });

      await this.learnerProgressService.recordAttemptOutcome(tx, {
        learnerId: input.learnerId,
        topicId: currentSessionItem.questionItem.topicId,
        isCorrect,
        supportedErrorTags: currentSessionItem.questionItem.supportedErrorTags,
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
          where: {
            id: session.examCycleId,
          },
          data: {
            progressState: LearnerProgressState.today_available,
          },
        });
      }
    });

    this.logger.log(
      JSON.stringify({
        event: "answer_submitted",
        learnerId: input.learnerId,
        sessionId: input.sessionId,
        sessionItemId: currentSessionItem.id,
        isCorrect,
        sessionStatus: nextStatus,
      }),
    );

    return {
      isCorrect,
      feedbackType,
      feedbackText: this.curriculumService.getFeedbackText(feedbackType),
      sessionStatus: nextStatus,
    };
  }

  async getSessionSummary(input: { learnerId: string; sessionId: string }) {
    const session = await this.prisma.session.findFirst({
      where: {
        id: input.sessionId,
        learnerId: input.learnerId,
      },
      include: {
        attempts: true,
      },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (session.status !== SessionStatus.completed) {
      throw new ConflictException("Session incomplete");
    }

    const correctCount = session.attempts.filter(
      (attempt) => attempt.answerOutcome === "correct",
    ).length;

    return {
      sessionId: session.id,
      totalItems: session.totalItems,
      correctCount,
      incorrectCount: session.totalItems - correctCount,
    };
  }

  private getActiveExamCycle(learnerId: string) {
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

  private createCheckpointToken() {
    return randomUUID();
  }

  private readChoices(choices: Prisma.JsonValue) {
    if (!Array.isArray(choices)) {
      return [];
    }

    return choices.filter((choice): choice is string => typeof choice === "string");
  }
}
