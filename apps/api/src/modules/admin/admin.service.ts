import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { SessionStatus, type SessionMode } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CurriculumService } from "../curriculum/curriculum.service";
import { deriveProgrammingSummaryCodes } from "../session/programming-summary.util";

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumService: CurriculumService,
  ) {}

  async listRecentLearners() {
    const recentProfiles = await this.prisma.programmingProfile.findMany({
      where: {
        onboardingComplete: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        learner: {
          include: {
            programmingPersona: {
              include: {
                focusConcept: true,
              },
            },
            sessions: {
              include: {
                focusConcept: true,
              },
              orderBy: {
                generatedAt: "desc",
              },
              take: 10,
            },
            telemetryEvents: {
              orderBy: {
                occurredAt: "desc",
              },
              take: 1,
            },
          },
        },
      },
      take: 10,
    });

    return recentProfiles.map((profile) => {
      const activeDiagnosticSession = profile.learner.sessions.find(
        (session) =>
          session.sessionType === "diagnostic" &&
          session.status !== SessionStatus.completed,
      );
      const activeDailySession = profile.learner.sessions.find(
        (session) =>
          session.sessionType === "daily_practice" &&
          session.status !== SessionStatus.completed,
      );
      const latestDailySession = profile.learner.sessions.find(
        (session) => session.sessionType === "daily_practice",
      );
      const latestSession = profile.learner.sessions[0] ?? null;
      const latestTelemetry = profile.learner.telemetryEvents[0] ?? null;

      return {
        learnerId: profile.learnerId,
        focusConceptId:
          profile.learner.programmingPersona?.focusConceptId ??
          latestDailySession?.focusConceptId ??
          "",
        focusConceptLabel:
          profile.learner.programmingPersona?.focusConcept?.learnerLabel ??
          latestDailySession?.focusConcept?.learnerLabel ??
          "",
        sessionMode:
          activeDailySession?.sessionMode ?? latestDailySession?.sessionMode ?? null,
        sessionMomentumState:
          profile.learner.programmingPersona?.sessionMomentumState ?? "unknown",
        activeDiagnosticSessionId: activeDiagnosticSession?.id ?? "",
        activeDailySessionId: activeDailySession?.id ?? "",
        lastActivityAt: this.getLatestDate([
          latestTelemetry?.occurredAt ?? null,
          latestSession?.completedAt ?? null,
          latestSession?.startedAt ?? null,
          latestSession?.generatedAt ?? null,
          profile.updatedAt,
        ]).toISOString(),
      };
    });
  }

  async getLearnerLookup(learnerId: string) {
    const learner = await this.prisma.learner.findUnique({
      where: { id: learnerId },
      include: {
        programmingProfile: true,
        programmingPersona: {
          include: {
            focusConcept: true,
          },
        },
      },
    });

    if (!learner) {
      throw new NotFoundException("Learner not found");
    }

    const [sessions, conceptStates, recentErrorTags, latestCompletedDailySession] =
      await Promise.all([
        this.prisma.session.findMany({
          where: { learnerId },
          include: {
            focusConcept: true,
          },
          orderBy: {
            generatedAt: "desc",
          },
          take: 10,
        }),
        this.prisma.learnerProgrammingConceptState.findMany({
          where: { learnerId },
          include: {
            concept: true,
          },
          orderBy: {
            concept: {
              sequenceOrder: "asc",
            },
          },
        }),
        this.prisma.attempt.findMany({
          where: {
            learnerId,
            primaryErrorTag: {
              not: null,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
        }),
        this.prisma.session.findFirst({
          where: {
            learnerId,
            sessionType: "daily_practice",
            status: SessionStatus.completed,
          },
          include: {
            focusConcept: true,
            attempts: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: {
            completedAt: "desc",
          },
        }),
      ]);

    const activeDiagnosticSession = sessions.find(
      (session) =>
        session.sessionType === "diagnostic" &&
        session.status !== SessionStatus.completed,
    );
    const activeDailySession = sessions.find(
      (session) =>
        session.sessionType === "daily_practice" &&
        session.status !== SessionStatus.completed,
    );

    return {
      learnerId,
      onboardingProfile: learner.programmingProfile
        ? {
            priorProgrammingExposure:
              learner.programmingProfile.priorProgrammingExposure,
            currentComfortLevel: learner.programmingProfile.currentComfortLevel,
            biggestDifficulty: learner.programmingProfile.biggestDifficulty,
            preferredHelpStyle: learner.programmingProfile.preferredHelpStyle,
          }
        : null,
      personaSnapshot: {
        focusConceptId: learner.programmingPersona?.focusConceptId ?? "",
        focusConceptLabel:
          learner.programmingPersona?.focusConcept?.learnerLabel ?? "",
        preferredHelpStyle: learner.programmingPersona?.preferredHelpStyle ?? "",
        syntaxStabilityState:
          learner.programmingPersona?.syntaxStabilityState ?? "unknown",
        logicTracingState:
          learner.programmingPersona?.logicTracingState ?? "unknown",
        debuggingResilienceState:
          learner.programmingPersona?.debuggingResilienceState ?? "unknown",
        sessionMomentumState:
          learner.programmingPersona?.sessionMomentumState ?? "unknown",
        conceptStates: conceptStates.map((state) => ({
          conceptId: state.conceptId,
          conceptLabel: state.concept.learnerLabel,
          masteryState: state.masteryState,
          recentErrorTag: state.recentErrorTag,
          lastObservedAt: state.lastObservedAt?.toISOString() ?? "",
        })),
      },
      activeDiagnosticSessionId: activeDiagnosticSession?.id ?? "",
      activeDailySessionId: activeDailySession?.id ?? "",
      recentErrorTags: recentErrorTags.map((attempt) => ({
        primaryErrorTag: attempt.primaryErrorTag,
        createdAt: attempt.createdAt.toISOString(),
        sessionId: attempt.sessionId,
        sessionItemId: attempt.sessionItemId,
      })),
      latestSummarySnapshot: latestCompletedDailySession
        ? this.buildLatestSummarySnapshot(latestCompletedDailySession)
        : null,
    };
  }

  async getSessionPreview(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        focusConcept: true,
        sessionItems: {
          orderBy: { sequenceOrder: "asc" },
        },
      },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    const taskMap = await this.curriculumService.getTasksByIds(
      session.sessionItems.map((item) => item.questionItemId),
    );

    return {
      sessionId: session.id,
      sessionType: session.sessionType,
      sessionMode: session.sessionMode,
      focusConceptId: session.focusConceptId,
      focusConceptLabel: session.focusConcept?.learnerLabel ?? "",
      status: session.status,
      currentIndex: session.currentIndex,
      totalItems: session.totalItems,
      items: session.sessionItems.map((item) => {
        const task = taskMap.get(item.questionItemId);

        return {
          sessionItemId: item.id,
          sequenceOrder: item.sequenceOrder,
          taskId: item.questionItemId,
          conceptId: task?.conceptId ?? "",
          conceptLabel: task?.concept.learnerLabel ?? "",
          taskType: task?.taskType ?? item.slotType,
          isActive: task?.isActive ?? false,
        };
      }),
    };
  }

  async deactivateQuestionItem(questionItemId: string) {
    const existing = await this.prisma.questionItem.findUnique({
      where: { id: questionItemId },
      select: { id: true, topicId: true, isActive: true },
    });

    if (!existing) {
      throw new NotFoundException("Question item not found");
    }

    if (!existing.isActive) {
      return {
        questionItemId,
        isActive: false,
      };
    }

    const activeTopicItemCount = await this.prisma.questionItem.count({
      where: {
        topicId: existing.topicId,
        isActive: true,
      },
    });

    if (activeTopicItemCount <= 1) {
      this.logger.warn(
        JSON.stringify({
          event: "question_item_deactivate_last_active_blocked",
          questionItemId,
          topicId: existing.topicId,
        }),
      );
      throw new ConflictException("Cannot deactivate last active item for topic");
    }

    await this.prisma.questionItem.update({
      where: { id: questionItemId },
      data: { isActive: false },
    });

    this.logger.log(
      JSON.stringify({
        event: "question_item_deactivated",
        questionItemId,
      }),
    );

    return {
      questionItemId,
      isActive: false,
    };
  }

  private buildLatestSummarySnapshot(session: {
    id: string;
    sessionMode: SessionMode | null;
    focusConceptId: string | null;
    focusConcept: {
      learnerLabel: string;
    } | null;
    completedAt: Date | null;
    attempts: Array<{
      isCorrect: boolean | null;
      primaryErrorTag: any;
      helpKindUsed: any;
    }>;
    totalItems: number;
  }) {
    const summaryCodes = deriveProgrammingSummaryCodes({
      sessionMode: session.sessionMode,
      totalItems: session.totalItems,
      attempts: session.attempts,
    });

    return {
      sessionId: session.id,
      sessionMode: session.sessionMode,
      focusConceptId: session.focusConceptId ?? "",
      focusConceptLabel: session.focusConcept?.learnerLabel ?? "",
      completedAt: session.completedAt?.toISOString() ?? "",
      whatImproved: {
        code: summaryCodes.whatImprovedCode,
      },
      whatNeedsSupport: {
        code: summaryCodes.whatNeedsSupportCode,
      },
      studyPatternObserved: {
        code: summaryCodes.studyPatternCode,
      },
    };
  }

  private getLatestDate(values: Array<Date | null>) {
    const timestamps = values
      .filter((value): value is Date => value instanceof Date)
      .map((value) => value.getTime());

    return new Date(Math.max(...timestamps));
  }
}
