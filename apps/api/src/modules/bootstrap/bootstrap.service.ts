import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  ComfortLevel,
  HelpKind,
  LearnerProgressState,
  ProgrammingDifficultyArea,
  ProgrammingExposure,
  SessionStatus,
  SessionType,
} from "@prisma/client";
import { CoursePackContextService } from "../course-pack/course-pack-context.service";
import { CurriculumService } from "../curriculum/curriculum.service";
import { LearnerProgressService } from "../learner/learner-progress.service";
import { ProgrammingPlannerService } from "../learner/programming-planner.service";
import { PrismaService } from "../../prisma/prisma.service";
import { TelemetryService } from "../telemetry/telemetry.service";

@Injectable()
export class BootstrapService {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumService: CurriculumService,
    private readonly coursePackContextService: CoursePackContextService,
    private readonly learnerProgressService: LearnerProgressService,
    private readonly programmingPlannerService: ProgrammingPlannerService,
    private readonly telemetryService: TelemetryService,
  ) {}

  async getBootState(learnerId?: string) {
    if (!learnerId) {
      return {
        learnerId: "",
        onboardingComplete: false,
        hasActiveDiagnostic: false,
        hasCompletedDiagnostic: false,
        hasActiveDailySession: false,
        nextRoute: "/onboarding" as const,
      };
    }

    const profile = await this.prisma.programmingProfile.findUnique({
      where: { learnerId },
    });

    if (!profile?.onboardingComplete) {
      return {
        learnerId,
        onboardingComplete: false,
        hasActiveDiagnostic: false,
        hasCompletedDiagnostic: false,
        hasActiveDailySession: false,
        nextRoute: "/onboarding" as const,
      };
    }

    const sessions = await this.prisma.session.findMany({
      where: { learnerId },
      select: {
        sessionType: true,
        status: true,
      },
    });

    const hasActiveDiagnostic = sessions.some(
      (session) =>
        session.sessionType === SessionType.diagnostic &&
        session.status !== SessionStatus.completed,
    );
    const hasCompletedDiagnostic = sessions.some(
      (session) =>
        session.sessionType === SessionType.diagnostic &&
        session.status === SessionStatus.completed,
    );
    const hasActiveDailySession = sessions.some(
      (session) =>
        session.sessionType === SessionType.daily_practice &&
        session.status !== SessionStatus.completed,
    );

    return {
      learnerId,
      onboardingComplete: true,
      hasActiveDiagnostic,
      hasCompletedDiagnostic,
      hasActiveDailySession,
      nextRoute: hasCompletedDiagnostic ? "/today" : "/diagnostic",
    };
  }

  async completeOnboarding(input: {
    learnerId?: string;
    priorProgrammingExposure: string;
    currentComfortLevel: string;
    biggestDifficulty: string;
    preferredHelpStyle: string;
  }) {
    const learnerId = await this.ensureLearner(input.learnerId);
    const now = new Date();
    const activeExamCycle = await this.prisma.examCycle.findFirst({
      where: { learnerId },
      orderBy: { createdAt: "desc" },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.programmingProfile.upsert({
        where: { learnerId },
        update: {
          priorProgrammingExposure:
            input.priorProgrammingExposure as ProgrammingExposure,
          currentComfortLevel: input.currentComfortLevel as ComfortLevel,
          biggestDifficulty:
            input.biggestDifficulty as ProgrammingDifficultyArea,
          preferredHelpStyle: input.preferredHelpStyle as HelpKind,
          onboardingComplete: true,
          onboardingCompletedAt: now,
        },
        create: {
          learnerId,
          priorProgrammingExposure:
            input.priorProgrammingExposure as ProgrammingExposure,
          currentComfortLevel: input.currentComfortLevel as ComfortLevel,
          biggestDifficulty:
            input.biggestDifficulty as ProgrammingDifficultyArea,
          preferredHelpStyle: input.preferredHelpStyle as HelpKind,
          onboardingComplete: true,
          onboardingCompletedAt: now,
        },
      });

      await tx.learnerProgrammingPersona.upsert({
        where: { learnerId },
        update: {
          modelVersion: "programming_persona_v1",
          preferredHelpStyle: input.preferredHelpStyle as HelpKind,
        },
        create: {
          learnerId,
          modelVersion: "programming_persona_v1",
          preferredHelpStyle: input.preferredHelpStyle as HelpKind,
        },
      });

      if (activeExamCycle) {
        await tx.examCycle.update({
          where: { id: activeExamCycle.id },
          data: {
            examDate: now,
            activeUnitId: this.curriculumService.getProgrammingUnitId(),
            onboardingComplete: true,
            progressState: LearnerProgressState.onboarding_complete,
          },
        });
      } else {
        await tx.examCycle.create({
          data: {
            learnerId,
            examDate: now,
            activeUnitId: this.curriculumService.getProgrammingUnitId(),
            onboardingComplete: true,
            progressState: LearnerProgressState.onboarding_complete,
          },
        });
      }
    });

    await this.learnerProgressService.ensureProgrammingPersona(learnerId);
    await this.telemetryService.recordEvent({
      eventName: "tc_onboarding_completed",
      learnerId,
      route: "/onboarding",
      properties: {
        priorProgrammingExposure: input.priorProgrammingExposure,
        currentComfortLevel: input.currentComfortLevel,
        biggestDifficulty: input.biggestDifficulty,
        preferredHelpStyle: input.preferredHelpStyle,
      },
    });

    return {
      learnerId,
      onboardingComplete: true,
      nextRoute: "/diagnostic" as const,
    };
  }

  async getTodaySummary(learnerId: string) {
    const profile = await this.prisma.programmingProfile.findUnique({
      where: { learnerId },
    });

    if (!profile?.onboardingComplete) {
      throw new BadRequestException("Onboarding incomplete");
    }

    const completedDiagnostic = await this.prisma.session.findFirst({
      where: {
        learnerId,
        sessionType: SessionType.diagnostic,
        status: SessionStatus.completed,
      },
      select: { id: true },
    });

    if (!completedDiagnostic) {
      this.logger.warn(
        JSON.stringify({
          event: "today_requested_before_programming_diagnostic_complete",
          learnerId,
        }),
      );
      throw new BadRequestException("Diagnostic incomplete");
    }

    const activeDailySession = await this.prisma.session.findFirst({
      where: {
        learnerId,
        sessionType: SessionType.daily_practice,
        status: {
          in: [SessionStatus.generated, SessionStatus.in_progress],
        },
      },
      orderBy: {
        generatedAt: "desc",
      },
    });

    const decision = await this.programmingPlannerService.getProgrammingState(
      learnerId,
    );

    const packProgressMemory = decision.activeCourseContext
      ? await this.coursePackContextService.getPackProgressMemory({
          learnerId,
          currentFocusConceptId: decision.focusConceptId,
          currentFocusCompiledConceptId: decision.focusCompiledConceptId,
          currentFocusConceptLabel: decision.focusConceptLabel,
        })
      : null;
    const recurringFocusDecision = decision.activeCourseContext
      ? await this.coursePackContextService.getRecurringFocusDecision({
          learnerId,
          currentFocusConceptId: decision.focusConceptId,
          currentFocusCompiledConceptId: decision.focusCompiledConceptId,
          currentFocusConceptLabel: decision.focusConceptLabel,
          packProgressMemory,
        })
      : null;

    const payload = {
      screenTitle: "حالتك البرمجية اليوم",
      programmingStateCode: decision.programmingStateCode,
      programmingStateLabel: decision.programmingStateLabel,
      focusConceptId: decision.focusConceptId,
      focusConceptLabel: decision.focusConceptLabel,
      focusCompiledConceptId: decision.focusCompiledConceptId,
      sessionMode: decision.sessionMode,
      sessionModeLabel: decision.sessionModeLabel,
      rationaleCode: decision.rationaleCode,
      rationaleText: decision.rationaleText,
      nextStepText: decision.nextStepText,
      activeCourseContext:
        decision.activeCourseContext ??
        (await this.coursePackContextService.getActiveContextPayload(learnerId)),
      packProgressMemory,
      recurringFocusDecision,
      primaryActionLabel: activeDailySession
        ? "متابعة تدريب اليوم"
        : "ابدأ تدريب اليوم",
      hasActiveDailySession: Boolean(activeDailySession),
      activeSessionId: activeDailySession?.id ?? null,
    };

    await this.telemetryService.recordEvent({
      eventName: "tc_programming_state_viewed",
      learnerId,
      route: "/today",
      properties: {
        focusConceptId: payload.focusConceptId,
        sessionMode: payload.sessionMode,
        hasActiveDailySession: payload.hasActiveDailySession,
      },
    });

    return payload;
  }

  private async ensureLearner(learnerId?: string) {
    if (learnerId) {
      const learner = await this.prisma.learner.upsert({
        where: { id: learnerId },
        update: {},
        create: { id: learnerId },
      });

      return learner.id;
    }

    const learner = await this.prisma.learner.create({
      data: {},
    });

    return learner.id;
  }
}
