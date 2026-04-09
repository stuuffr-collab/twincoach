import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type DailySessionPlanItem = {
  questionItemId: string;
  slotType: "repair" | "core" | "review";
};

@Injectable()
export class LearnerProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async recordAttemptOutcome(
    tx: Prisma.TransactionClient,
    input: {
      learnerId: string;
      topicId: string;
      isCorrect: boolean;
      supportedErrorTags: Prisma.JsonValue;
    },
  ) {
    const currentState = await tx.learnerTopicState.findUnique({
      where: {
        learnerId_topicId: {
          learnerId: input.learnerId,
          topicId: input.topicId,
        },
      },
    });

    const now = new Date();
    const nextEvidenceCount = (currentState?.validEvidenceCount ?? 0) + 1;
    const errorTags = this.readStringArray(input.supportedErrorTags);
    const hasWeakPrerequisiteSignal = errorTags.includes(
      "weak_prerequisite_knowledge",
    );

    const masteryState = input.isCorrect ? "building" : "needs_support";
    const prereqRiskState = input.isCorrect
      ? nextEvidenceCount >= 2
        ? "clear"
        : (currentState?.prereqRiskState ?? "clear")
      : hasWeakPrerequisiteSignal
        ? "elevated"
        : (currentState?.prereqRiskState ?? "clear");

    const nextReviewDueAt = input.isCorrect
      ? new Date(now.getTime() + 86_400_000)
      : now;

    await tx.learnerTopicState.upsert({
      where: {
        learnerId_topicId: {
          learnerId: input.learnerId,
          topicId: input.topicId,
        },
      },
      update: {
        masteryState,
        prereqRiskState,
        validEvidenceCount: nextEvidenceCount,
        lastEvidenceAt: now,
        nextReviewDueAt,
      },
      create: {
        learnerId: input.learnerId,
        topicId: input.topicId,
        masteryState,
        prereqRiskState,
        validEvidenceCount: nextEvidenceCount,
        lastEvidenceAt: now,
        nextReviewDueAt,
      },
    });
  }

  async getReadinessSummary(learnerId: string) {
    const now = new Date();
    const [activeTopics, topicStates] = await Promise.all([
      this.prisma.topic.findMany({
        where: { isActive: true },
        orderBy: { sequenceOrder: "asc" },
      }),
      this.prisma.learnerTopicState.findMany({
        where: { learnerId },
      }),
    ]);

    const evidenceTopicIds = new Set(
      topicStates
        .filter((state) => state.validEvidenceCount > 0)
        .map((state) => state.topicId),
    );
    const totalEvidenceCount = topicStates.reduce(
      (count, state) => count + state.validEvidenceCount,
      0,
    );

    const unseenHighWeightTopics = activeTopics.filter(
      (topic) => topic.examWeight >= 2 && !evidenceTopicIds.has(topic.id),
    ).length;

    const dueReviewCount = topicStates.filter(
      (state) => state.nextReviewDueAt && state.nextReviewDueAt <= now,
    ).length;

    const weakTopicCount = topicStates.filter(
      (state) =>
        state.masteryState === "needs_support" ||
        state.prereqRiskState === "elevated",
    ).length;

    if (
      evidenceTopicIds.size < 4 ||
      totalEvidenceCount < activeTopics.length + 2 ||
      unseenHighWeightTopics > 0
    ) {
      return {
        readinessBand: "Insufficient Evidence",
        explanation:
          "You have not answered enough across the exam scope to support a stronger readiness signal yet.",
        nextStep:
          "Keep completing short study sessions so we can confirm weak areas before the exam.",
      };
    }

    if (weakTopicCount > 0 || dueReviewCount > 0) {
      return {
        readinessBand: "Needs Review",
        explanation:
          "You have active weak areas or due review that must be cleared before we can raise your readiness signal.",
        nextStep:
          "Complete today's session and clear due review before relying on readiness.",
      };
    }

    return {
      readinessBand: "Building Readiness",
      explanation:
        "You have enough evidence to show progress, but the signal stays conservative until coverage remains stable.",
      nextStep:
        "Keep completing daily sessions and protect your review work across the exam topics.",
    };
  }

  async buildDailySessionPlan(learnerId: string): Promise<DailySessionPlanItem[]> {
    const now = new Date();
    const [topicStates, activeItems] = await Promise.all([
      this.prisma.learnerTopicState.findMany({
        where: { learnerId },
      }),
      this.prisma.questionItem.findMany({
        where: { isActive: true },
        include: { topic: true },
      }),
    ]);

    const sortedItems = [...activeItems].sort((left, right) => {
      if (left.topic.examWeight !== right.topic.examWeight) {
        return right.topic.examWeight - left.topic.examWeight;
      }

      if (left.topic.sequenceOrder !== right.topic.sequenceOrder) {
        return left.topic.sequenceOrder - right.topic.sequenceOrder;
      }

      return left.id.localeCompare(right.id);
    });

    const stateByTopicId = new Map(
      topicStates.map((state) => [state.topicId, state] as const),
    );
    const selectedItemIds = new Set<string>();
    const plan: DailySessionPlanItem[] = [];

    const pickItem = (
      predicate: (item: (typeof sortedItems)[number]) => boolean,
      slotType: DailySessionPlanItem["slotType"],
    ) => {
      const match = sortedItems.find(
        (item) => !selectedItemIds.has(item.id) && predicate(item),
      );

      if (!match) {
        return;
      }

      selectedItemIds.add(match.id);
      plan.push({
        questionItemId: match.id,
        slotType,
      });
    };

    pickItem((item) => {
      const state = stateByTopicId.get(item.topicId);
      return Boolean(state?.nextReviewDueAt && state.nextReviewDueAt <= now);
    }, "review");

    pickItem((item) => {
      const state = stateByTopicId.get(item.topicId);
      return (
        state?.masteryState === "needs_support" ||
        state?.prereqRiskState === "elevated"
      );
    }, "repair");

    pickItem(() => true, "core");

    while (plan.length < Math.min(3, sortedItems.length)) {
      pickItem(() => true, "core");
    }

    return plan;
  }

  private readStringArray(input: Prisma.JsonValue) {
    if (!Array.isArray(input)) {
      return [];
    }

    return input.filter((value): value is string => typeof value === "string");
  }
}
