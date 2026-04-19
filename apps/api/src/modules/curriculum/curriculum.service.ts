import {
  FeedbackType,
  HelpKind,
  ProgrammingTaskSetRole,
  SessionMode,
} from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ProgrammingFixtureService } from "./programming-fixture.service";

const GENERIC_FEEDBACK: Record<FeedbackType, string> = {
  correct: "هذه خطوة موفقة.",
  needs_review: "هذه الإجابة ليست الأدق بعد. لنراجع الفكرة الرئيسية قبل المتابعة.",
  try_fix: "هذه الإجابة ليست الأدق بعد. راجع الخطوة الأساسية وجرّب تعديلًا واحدًا.",
  needs_another_check:
    "هذه الإجابة ليست الأدق بعد. نحتاج فحصًا أخيرًا بهدوء قبل المتابعة.",
};

@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programmingFixtureService: ProgrammingFixtureService,
  ) {}

  getProgrammingUnitId() {
    return "python_cs1_v1";
  }

  async getProgrammingConcepts() {
    await this.programmingFixtureService.ensureProgrammingFixtures();

    return this.prisma.programmingConcept.findMany({
      where: { isActive: true },
      orderBy: { sequenceOrder: "asc" },
    });
  }

  async getDiagnosticTasks() {
    await this.programmingFixtureService.ensureProgrammingFixtures();

    return this.prisma.programmingTask.findMany({
      where: {
        taskSetRole: ProgrammingTaskSetRole.diagnostic,
        isActive: true,
      },
      include: {
        concept: true,
        hintTemplate: true,
        feedbackTemplate: true,
      },
      orderBy: {
        concept: {
          sequenceOrder: "asc",
        },
      },
    });
  }

  async getPracticeTasks() {
    await this.programmingFixtureService.ensureProgrammingFixtures();

    return this.prisma.programmingTask.findMany({
      where: {
        taskSetRole: ProgrammingTaskSetRole.practice,
        isActive: true,
      },
      include: {
        concept: true,
        hintTemplate: true,
        feedbackTemplate: true,
      },
      orderBy: [
        {
          concept: {
            sequenceOrder: "asc",
          },
        },
        {
          id: "asc",
        },
      ],
    });
  }

  async getTaskById(taskId: string) {
    await this.programmingFixtureService.ensureProgrammingFixtures();

    return this.prisma.programmingTask.findUnique({
      where: { id: taskId },
      include: {
        concept: true,
        hintTemplate: true,
        feedbackTemplate: true,
      },
    });
  }

  async getTasksByIds(taskIds: string[]) {
    await this.programmingFixtureService.ensureProgrammingFixtures();

    const tasks = await this.prisma.programmingTask.findMany({
      where: {
        id: {
          in: taskIds,
        },
      },
      include: {
        concept: true,
        hintTemplate: true,
        feedbackTemplate: true,
      },
    });

    return new Map(tasks.map((task) => [task.id, task] as const));
  }

  async selectHelpTemplate(input: {
    taskType: string;
    sessionMode: SessionMode;
    preferredHelpStyle: HelpKind;
    fallbackHintTemplateId?: string | null;
  }) {
    await this.programmingFixtureService.ensureProgrammingFixtures();

    const templates = await this.prisma.programmingHintTemplate.findMany({
      orderBy: { id: "asc" },
    });

    const fallbackTemplate = input.fallbackHintTemplateId
      ? templates.find((template) => template.id === input.fallbackHintTemplateId) ??
        null
      : null;

    const preferredTemplate =
      templates.find(
        (template) =>
          template.helpKind === input.preferredHelpStyle &&
          this.includesString(template.allowedTaskTypes, input.taskType) &&
          this.includesString(template.allowedModes, input.sessionMode),
      ) ?? null;

    if (preferredTemplate) {
      return preferredTemplate;
    }

    if (
      fallbackTemplate &&
      this.includesString(fallbackTemplate.allowedTaskTypes, input.taskType) &&
      this.includesString(fallbackTemplate.allowedModes, input.sessionMode)
    ) {
      return fallbackTemplate;
    }

    return null;
  }

  getFeedbackText(input: {
    feedbackType: FeedbackType;
    templateText?: string | null;
  }) {
    if (input.templateText) {
      return input.templateText;
    }

    return GENERIC_FEEDBACK[input.feedbackType];
  }

  async getSummaryTemplateText(input: {
    summaryField: "whatImproved" | "whatNeedsSupport" | "studyPatternObserved" | "nextBestAction";
    triggerCode: string;
  }) {
    await this.programmingFixtureService.ensureProgrammingFixtures();

    const template = await this.prisma.programmingSummaryTemplate.findFirst({
      where: {
        summaryField: input.summaryField,
        triggerCode: input.triggerCode,
      },
    });

    return template?.templateText ?? "";
  }

  private includesString(input: unknown, expected: string) {
    if (!Array.isArray(input)) {
      return false;
    }

    return input.some((value) => value === expected);
  }
}
