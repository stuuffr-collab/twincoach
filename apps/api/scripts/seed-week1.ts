import { FeedbackType, PrismaClient, QuestionType } from "@prisma/client";
import seedPack from "../../../content/seed_ready_content_fixture_pack_ca05_v1.json";

process.loadEnvFile?.(".env");

const prisma = new PrismaClient();

async function main() {
  const allQuestionItems = [
    ...seedPack.diagnosticItems,
    ...(seedPack.reviewItems ?? []),
  ];

  for (const topic of seedPack.topics) {
    await prisma.topic.upsert({
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

  for (const item of allQuestionItems) {
    await prisma.questionItem.upsert({
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

  console.log(
    JSON.stringify({
      topicsSeeded: seedPack.topics.length,
      diagnosticItemsSeeded: allQuestionItems.length,
    }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
