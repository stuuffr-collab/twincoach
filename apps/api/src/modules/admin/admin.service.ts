import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { SessionStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { LearnerProgressService } from "../learner/learner-progress.service";

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly learnerProgressService: LearnerProgressService,
  ) {}

  async listRecentLearners() {
    const recentExamCycles = await this.prisma.examCycle.findMany({
      where: {
        onboardingComplete: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        sessions: {
          orderBy: {
            generatedAt: "desc",
          },
        },
      },
      take: 10,
    });

    return Promise.all(
      recentExamCycles.map(async (examCycle) => {
        const readiness = await this.learnerProgressService.getReadinessSummary(
          examCycle.learnerId,
        );
        const activeDiagnosticSession = examCycle.sessions.find(
          (session) =>
            session.sessionType === "diagnostic" &&
            session.status !== SessionStatus.completed,
        );
        const activeDailySession = examCycle.sessions.find(
          (session) =>
            session.sessionType === "daily" &&
            session.status !== SessionStatus.completed,
        );
        const lastSession = examCycle.sessions[0];

        return {
          learnerId: examCycle.learnerId,
          progressState: examCycle.progressState,
          activeUnitId: examCycle.activeUnitId,
          readinessBand: readiness.readinessBand,
          activeDiagnosticSessionId: activeDiagnosticSession?.id ?? "",
          activeDailySessionId: activeDailySession?.id ?? "",
          lastActivityAt: (lastSession?.generatedAt ?? examCycle.updatedAt).toISOString(),
        };
      }),
    );
  }

  async getLearnerLookup(learnerId: string) {
    const learner = await this.prisma.learner.findUnique({
      where: { id: learnerId },
    });

    if (!learner) {
      throw new NotFoundException("Learner not found");
    }

    const [examCycle, sessions, topicStates, attempts, readiness] = await Promise.all([
      this.prisma.examCycle.findFirst({
        where: { learnerId },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.session.findMany({
        where: { learnerId },
        orderBy: { generatedAt: "desc" },
        take: 5,
      }),
      this.prisma.learnerTopicState.findMany({
        where: { learnerId },
        include: { topic: true },
        orderBy: { topic: { sequenceOrder: "asc" } },
      }),
      this.prisma.attempt.findMany({
        where: { learnerId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.learnerProgressService.getReadinessSummary(learnerId),
    ]);

    const activeDiagnosticSession = sessions.find(
      (session) => session.sessionType === "diagnostic" && session.status !== SessionStatus.completed,
    );
    const activeDailySession = sessions.find(
      (session) => session.sessionType === "daily" && session.status !== SessionStatus.completed,
    );

    return {
      learnerId,
      onboardingComplete: examCycle?.onboardingComplete ?? false,
      progressState: examCycle?.progressState ?? "new",
      activeUnitId: examCycle?.activeUnitId ?? "",
      readinessBand: readiness.readinessBand,
      activeDiagnosticSessionId: activeDiagnosticSession?.id ?? "",
      activeDailySessionId: activeDailySession?.id ?? "",
      topicStates: topicStates.map((state) => ({
        topicId: state.topicId,
        topicTitle: state.topic.title,
        masteryState: state.masteryState,
        prereqRiskState: state.prereqRiskState,
        validEvidenceCount: state.validEvidenceCount,
        nextReviewDueAt: state.nextReviewDueAt?.toISOString() ?? "",
      })),
      recentAttempts: attempts.map((attempt) => ({
        sessionId: attempt.sessionId,
        sessionItemId: attempt.sessionItemId,
        questionItemId: attempt.questionItemId,
        answerOutcome: attempt.answerOutcome,
        createdAt: attempt.createdAt.toISOString(),
      })),
    };
  }

  async getSessionPreview(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        sessionItems: {
          orderBy: { sequenceOrder: "asc" },
          include: { questionItem: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    return {
      sessionId: session.id,
      sessionType: session.sessionType,
      status: session.status,
      currentIndex: session.currentIndex,
      totalItems: session.totalItems,
      items: session.sessionItems.map((item) => ({
        sessionItemId: item.id,
        sequenceOrder: item.sequenceOrder,
        slotType: item.slotType,
        questionItemId: item.questionItemId,
        topicId: item.questionItem.topicId,
        isActive: item.questionItem.isActive,
      })),
    };
  }

  async deactivateQuestionItem(questionItemId: string) {
    const existing = await this.prisma.questionItem.findUnique({
      where: { id: questionItemId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException("Question item not found");
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
}
