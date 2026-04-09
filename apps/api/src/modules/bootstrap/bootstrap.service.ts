import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { LearnerProgressState, SessionStatus, SessionType } from "@prisma/client";
import { CurriculumService } from "../curriculum/curriculum.service";
import { LearnerProgressService } from "../learner/learner-progress.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class BootstrapService {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumService: CurriculumService,
    private readonly learnerProgressService: LearnerProgressService,
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

    const examCycle = await this.prisma.examCycle.findFirst({
      where: { learnerId },
      orderBy: { createdAt: "desc" },
    });

    if (!examCycle || !examCycle.onboardingComplete) {
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
      where: { learnerId, examCycleId: examCycle.id },
      select: {
        sessionType: true,
        status: true,
      },
    });

    const hasActiveDiagnostic = sessions.some(
      (session) =>
        session.sessionType === "diagnostic" && session.status !== "completed",
    );

    const hasCompletedDiagnostic = sessions.some(
      (session) =>
        session.sessionType === "diagnostic" && session.status === "completed",
    );

    const hasActiveDailySession = sessions.some(
      (session) => session.sessionType === "daily" && session.status !== "completed",
    );

    return {
      learnerId,
      onboardingComplete: examCycle.onboardingComplete,
      hasActiveDiagnostic,
      hasCompletedDiagnostic,
      hasActiveDailySession,
      nextRoute: this.resolveNextRoute({
        onboardingComplete: examCycle.onboardingComplete,
        hasActiveDiagnostic,
        hasCompletedDiagnostic,
        hasActiveDailySession,
      }),
    };
  }

  async completeOnboarding(input: {
    learnerId?: string;
    examDate: string;
    activeUnitId: string;
  }) {
    const isValidActiveUnit = this.curriculumService
      .getActiveUnits()
      .some((unit) => unit.activeUnitId === input.activeUnitId);

    if (!isValidActiveUnit) {
      throw new BadRequestException("Invalid activeUnitId");
    }

    const learnerId = input.learnerId ?? (await this.createLearner()).id;

    await this.prisma.examCycle.create({
      data: {
        learnerId,
        examDate: new Date(input.examDate),
        activeUnitId: input.activeUnitId,
        onboardingComplete: true,
        progressState: LearnerProgressState.onboarding_complete,
      },
    });

    this.logger.log(
      JSON.stringify({
        event: "onboarding_completed",
        learnerId,
        activeUnitId: input.activeUnitId,
        examDate: input.examDate,
      }),
    );

    return {
      learnerId,
      onboardingComplete: true,
      nextRoute: "/diagnostic" as const,
    };
  }

  async getTodaySummary(learnerId: string) {
    const examCycle = await this.prisma.examCycle.findFirst({
      where: {
        learnerId,
        onboardingComplete: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

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
      this.logger.warn(
        JSON.stringify({
          event: "today_requested_before_diagnostic_complete",
          learnerId,
          examCycleId: examCycle.id,
        }),
      );
      throw new BadRequestException("Diagnostic incomplete");
    }

    const readiness = await this.learnerProgressService.getReadinessSummary(
      learnerId,
    );

    const activeDailySession = await this.prisma.session.findFirst({
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

    return {
      examDate: this.toDateString(examCycle.examDate),
      daysToExam: this.calculateDaysToExam(examCycle.examDate),
      readinessBand: readiness.readinessBand,
      primaryActionLabel: activeDailySession
        ? "Resume 10-Min Session"
        : "Start 10-Min Session",
      hasActiveDailySession: Boolean(activeDailySession),
    };
  }

  private resolveNextRoute(state: {
    onboardingComplete: boolean;
    hasActiveDiagnostic: boolean;
    hasCompletedDiagnostic: boolean;
    hasActiveDailySession: boolean;
  }) {
    if (!state.onboardingComplete) {
      return "/onboarding" as const;
    }

    if (state.hasActiveDiagnostic) {
      return "/diagnostic" as const;
    }

    if (!state.hasCompletedDiagnostic) {
      return "/diagnostic" as const;
    }

    return "/today" as const;
  }

  private createLearner() {
    return this.prisma.learner.create({
      data: {},
    });
  }

  private toDateString(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private calculateDaysToExam(examDate: Date) {
    const today = new Date();
    const utcToday = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const utcExamDate = Date.UTC(
      examDate.getUTCFullYear(),
      examDate.getUTCMonth(),
      examDate.getUTCDate(),
    );

    return Math.max(0, Math.ceil((utcExamDate - utcToday) / 86_400_000));
  }
}
