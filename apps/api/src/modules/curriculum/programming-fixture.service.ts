import {
  AnswerFormat,
  FeedbackType,
  HelpKind,
  ProgrammingTaskSetRole,
  ProgrammingTaskType,
  QuestionType,
  SummaryTemplateField,
} from "@prisma/client";
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import concepts from "../../../../../content/programming_v1/concepts.json";
import diagnosticTasks from "../../../../../content/programming_v1/diagnostic_tasks.json";
import feedbackTemplates from "../../../../../content/programming_v1/feedback_templates.json";
import hintTemplates from "../../../../../content/programming_v1/hint_templates.json";
import practiceTasksConditionals from "../../../../../content/programming_v1/practice_tasks_conditionals.json";
import practiceTasksDebugging from "../../../../../content/programming_v1/practice_tasks_debugging.json";
import practiceTasksFunctions from "../../../../../content/programming_v1/practice_tasks_functions.json";
import practiceTasksLoops from "../../../../../content/programming_v1/practice_tasks_loops.json";
import practiceTasksTracing from "../../../../../content/programming_v1/practice_tasks_tracing.json";
import practiceTasksVariables from "../../../../../content/programming_v1/practice_tasks_variables.json";
import summaryTemplates from "../../../../../content/programming_v1/summary_templates.json";

const practiceTasks = [
  ...practiceTasksVariables,
  ...practiceTasksConditionals,
  ...practiceTasksLoops,
  ...practiceTasksFunctions,
  ...practiceTasksTracing,
  ...practiceTasksDebugging,
];

@Injectable()
export class ProgrammingFixtureService {
  private readonly logger = new Logger(ProgrammingFixtureService.name);
  private bootstrapPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async ensureProgrammingFixtures() {
    const counts = await this.readCounts();

    if (this.isFixturePackValid(counts)) {
      return;
    }

    if (this.bootstrapPromise) {
      await this.bootstrapPromise;
      return;
    }

    this.logger.warn(
      JSON.stringify({
        event: "programming_fixture_pack_invalid",
        counts,
      }),
    );

    this.bootstrapPromise = this.repairProgrammingFixtures();

    try {
      await this.bootstrapPromise;
    } finally {
      this.bootstrapPromise = null;
    }
  }

  private async repairProgrammingFixtures() {
    await this.prisma.$transaction(async (tx) => {
      await tx.questionItem.deleteMany({
        where: {
          id: {
            in: [...diagnosticTasks, ...practiceTasks].map((task) => task.taskId),
          },
        },
      });
      await tx.topic.deleteMany({
        where: {
          id: {
            in: concepts.map((concept) => concept.conceptId),
          },
        },
      });
      await tx.programmingTask.deleteMany();
      await tx.programmingSummaryTemplate.deleteMany();
      await tx.programmingFeedbackTemplate.deleteMany();
      await tx.programmingHintTemplate.deleteMany();
      await tx.programmingConcept.deleteMany();

      await tx.programmingConcept.createMany({
        data: concepts.map((concept) => ({
          id: concept.conceptId,
          sequenceOrder: concept.sequenceOrder,
          learnerLabel: concept.learnerLabel,
          description: concept.description,
          isActive: concept.isActive,
        })),
      });

      await tx.topic.createMany({
        data: concepts.map((concept) => ({
          id: concept.conceptId,
          title: concept.learnerLabel,
          sequenceOrder: concept.sequenceOrder,
          examWeight: 1,
          isActive: concept.isActive,
        })),
      });

      await tx.programmingHintTemplate.createMany({
        data: hintTemplates.map((template) => ({
          id: template.hintTemplateId,
          helpKind: template.helpKind as HelpKind,
          label: template.label,
          templateText: template.templateText,
          allowedTaskTypes: template.allowedTaskTypes,
          allowedModes: template.allowedModes,
        })),
      });

      await tx.programmingFeedbackTemplate.createMany({
        data: feedbackTemplates.map((template) => ({
          id: template.feedbackTemplateId,
          feedbackType: template.feedbackType as FeedbackType,
          templateText: template.templateText,
          allowedTaskTypes: template.allowedTaskTypes,
        })),
      });

      await tx.programmingSummaryTemplate.createMany({
        data: summaryTemplates.map((template) => ({
          id: template.summaryTemplateId,
          summaryField: template.summaryField as SummaryTemplateField,
          triggerCode: template.triggerCode,
          templateText: template.templateText,
        })),
      });

      await tx.programmingTask.createMany({
        data: diagnosticTasks.map((task) => ({
          id: task.taskId,
          conceptId: task.conceptId,
          taskSetRole: ProgrammingTaskSetRole.diagnostic,
          taskType: task.taskType as ProgrammingTaskType,
          prompt: task.prompt,
          codeSnippet: task.codeSnippet,
          choices: task.choices,
          answerFormat: task.answerFormat as AnswerFormat,
          correctAnswer: task.correctAnswer,
          helperText: this.getHelperText({
            answerFormat: task.answerFormat,
            taskType: task.taskType,
          }),
          difficulty: task.difficulty,
          estimatedTimeSec: task.estimatedTimeSec,
          supportedErrorTags: task.supportedErrorTags,
          modeTags: undefined,
          hintTemplateId: null,
          feedbackTemplateId: null,
          isActive: task.isActive,
        })),
      });

      await tx.programmingTask.createMany({
        data: practiceTasks.map((task) => ({
          id: task.taskId,
          conceptId: task.conceptId,
          taskSetRole: ProgrammingTaskSetRole.practice,
          taskType: task.taskType as ProgrammingTaskType,
          prompt: task.prompt,
          codeSnippet: task.codeSnippet,
          choices: task.choices,
          answerFormat: task.answerFormat as AnswerFormat,
          correctAnswer: task.correctAnswer,
          helperText: this.getHelperText({
            answerFormat: task.answerFormat,
            taskType: task.taskType,
          }),
          difficulty: task.difficulty,
          estimatedTimeSec: task.estimatedTimeSec,
          supportedErrorTags: task.supportedErrorTags,
          modeTags: task.modeTags,
          hintTemplateId: task.hintTemplateId,
          feedbackTemplateId: task.feedbackTemplateId,
          isActive: task.isActive,
        })),
      });

      const feedbackTypeById = new Map(
        feedbackTemplates.map((template) => [
          template.feedbackTemplateId,
          template.feedbackType as FeedbackType,
        ]),
      );

      await tx.questionItem.createMany({
        data: [...diagnosticTasks, ...practiceTasks].map((task) => ({
          id: task.taskId,
          topicId: task.conceptId,
          role:
            "modeTags" in task
              ? "programming_practice_task"
              : "programming_diagnostic_task",
          questionType:
            task.answerFormat === "single_choice"
              ? QuestionType.multiple_choice
              : QuestionType.expression_choice,
          stem: task.prompt,
          choices: task.choices,
          inputMode:
            task.answerFormat === "single_choice" ? "single_choice" : "short_text",
          correctAnswer: task.correctAnswer,
          difficulty: task.difficulty,
          estimatedTimeSec: task.estimatedTimeSec,
          supportedFeedbackType:
            "feedbackTemplateId" in task && task.feedbackTemplateId
              ? (feedbackTypeById.get(task.feedbackTemplateId as string) ??
                FeedbackType.needs_review)
              : task.taskType === "trace_reasoning"
                ? FeedbackType.needs_another_check
                : task.taskType === "bug_spotting" ||
                    task.taskType === "code_completion"
                  ? FeedbackType.try_fix
                  : FeedbackType.needs_review,
          supportedErrorTags: task.supportedErrorTags,
          isActive: task.isActive,
        })),
      });
    });

    const repairedCounts = await this.readCounts();

    this.logger.log(
      JSON.stringify({
        event: "programming_fixture_pack_repaired",
        counts: repairedCounts,
      }),
    );
  }

  private async readCounts() {
    const [
      conceptCount,
      diagnosticTaskCount,
      practiceTaskCount,
      hintTemplateCount,
      feedbackTemplateCount,
      summaryTemplateCount,
    ] = await Promise.all([
      this.prisma.programmingConcept.count({
        where: { isActive: true },
      }),
      this.prisma.programmingTask.count({
        where: {
          taskSetRole: ProgrammingTaskSetRole.diagnostic,
          isActive: true,
        },
      }),
      this.prisma.programmingTask.count({
        where: {
          taskSetRole: ProgrammingTaskSetRole.practice,
          isActive: true,
        },
      }),
      this.prisma.programmingHintTemplate.count(),
      this.prisma.programmingFeedbackTemplate.count(),
      this.prisma.programmingSummaryTemplate.count(),
    ]);

    return {
      conceptCount,
      diagnosticTaskCount,
      practiceTaskCount,
      hintTemplateCount,
      feedbackTemplateCount,
      summaryTemplateCount,
    };
  }

  private isFixturePackValid(input: {
    conceptCount: number;
    diagnosticTaskCount: number;
    practiceTaskCount: number;
    hintTemplateCount: number;
    feedbackTemplateCount: number;
    summaryTemplateCount: number;
  }) {
    return (
      input.conceptCount === 6 &&
      input.diagnosticTaskCount === 6 &&
      input.practiceTaskCount === 24 &&
      input.hintTemplateCount === 4 &&
      input.feedbackTemplateCount === 4 &&
      input.summaryTemplateCount === 4
    );
  }

  private getHelperText(input: {
    answerFormat: string;
    taskType: string;
  }) {
    if (input.answerFormat === "short_text") {
      return "Enter one short answer.";
    }

    if (input.taskType === "bug_spotting") {
      return "Choose the best fix or bug location.";
    }

    return "Choose one answer.";
  }
}
