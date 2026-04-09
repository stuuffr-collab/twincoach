import { Injectable } from "@nestjs/common";
import { FeedbackType, QuestionType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import seedPack from "../../../../../content/seed_ready_content_fixture_pack_ca05_v1.json";

@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  async seedWeekOneContent() {
    for (const topic of seedPack.topics) {
      await this.prisma.topic.upsert({
        where: { id: topic.topicId },
        update: {
          title: topic.title,
          sequenceOrder: topic.sequenceOrder,
          examWeight: topic.examWeight,
          isActive: topic.isActive,
        },
        create: {
          id: topic.topicId,
          title: topic.title,
          sequenceOrder: topic.sequenceOrder,
          examWeight: topic.examWeight,
          isActive: topic.isActive,
        },
      });
    }

    for (const item of seedPack.diagnosticItems) {
      await this.prisma.questionItem.upsert({
        where: { id: item.questionItemId },
        update: {
          topicId: item.topicId,
          role: item.role,
          questionType: item.questionType as QuestionType,
          stem: item.stem,
          choices: item.choices,
          inputMode: item.inputMode,
          correctAnswer: item.correctAnswer,
          difficulty: item.difficulty,
          estimatedTimeSec: item.estimatedTimeSec,
          supportedFeedbackType: item.supportedFeedbackType as FeedbackType,
          supportedErrorTags: item.supportedErrorTags,
          isActive: true,
        },
        create: {
          id: item.questionItemId,
          topicId: item.topicId,
          role: item.role,
          questionType: item.questionType as QuestionType,
          stem: item.stem,
          choices: item.choices,
          inputMode: item.inputMode,
          correctAnswer: item.correctAnswer,
          difficulty: item.difficulty,
          estimatedTimeSec: item.estimatedTimeSec,
          supportedFeedbackType: item.supportedFeedbackType as FeedbackType,
          supportedErrorTags: item.supportedErrorTags,
          isActive: true,
        },
      });
    }

    return {
      topicsSeeded: seedPack.topics.length,
      diagnosticItemsSeeded: seedPack.diagnosticItems.length,
    };
  }

  getActiveUnits() {
    return seedPack.activeUnits;
  }

  getDiagnosticItems() {
    return seedPack.diagnosticItems;
  }

  getDailySessionItems() {
    return seedPack.diagnosticItems.slice(0, 3);
  }

  getFeedbackText(feedbackType: FeedbackType) {
    return seedPack.feedbackFixtures[feedbackType];
  }
}
