import { BadRequestException, Injectable } from "@nestjs/common";
import { HelpKind, Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

type TelemetryClient = Prisma.TransactionClient | PrismaService | PrismaClient;

export type TelemetryEventName =
  | "tc_onboarding_completed"
  | "tc_diagnostic_started"
  | "tc_diagnostic_task_viewed"
  | "tc_diagnostic_answer_submitted"
  | "tc_programming_state_viewed"
  | "tc_session_started"
  | "tc_session_task_viewed"
  | "tc_session_answer_submitted"
  | "tc_session_help_revealed"
  | "tc_session_resumed"
  | "tc_session_completed"
  | "tc_summary_viewed";

type TelemetryInput = {
  eventName: TelemetryEventName;
  learnerId: string;
  route: string;
  sessionId?: string | null;
  sessionItemId?: string | null;
  properties: Record<string, unknown>;
  occurredAt?: Date;
};

const requiredPropertyMap: Record<TelemetryEventName, string[]> = {
  tc_onboarding_completed: [
    "priorProgrammingExposure",
    "currentComfortLevel",
    "biggestDifficulty",
    "preferredHelpStyle",
  ],
  tc_diagnostic_started: ["sessionId", "sessionType"],
  tc_diagnostic_task_viewed: [
    "sessionId",
    "sessionItemId",
    "taskId",
    "conceptId",
    "taskType",
    "currentIndex",
    "totalItems",
  ],
  tc_diagnostic_answer_submitted: [
    "sessionId",
    "sessionItemId",
    "taskId",
    "conceptId",
    "taskType",
    "attemptCount",
    "timeToFirstActionMs",
    "timeToSubmitMs",
    "isCorrect",
    "primaryErrorTag",
  ],
  tc_programming_state_viewed: [
    "focusConceptId",
    "sessionMode",
    "hasActiveDailySession",
  ],
  tc_session_started: [
    "sessionId",
    "sessionMode",
    "focusConceptId",
    "totalItems",
  ],
  tc_session_task_viewed: [
    "sessionId",
    "sessionMode",
    "sessionItemId",
    "taskId",
    "conceptId",
    "taskType",
    "currentIndex",
    "totalItems",
  ],
  tc_session_answer_submitted: [
    "sessionId",
    "sessionMode",
    "sessionItemId",
    "taskId",
    "conceptId",
    "taskType",
    "attemptCount",
    "timeToFirstActionMs",
    "timeToSubmitMs",
    "isCorrect",
    "primaryErrorTag",
  ],
  tc_session_help_revealed: [
    "sessionId",
    "sessionItemId",
    "taskId",
    "conceptId",
    "helpKind",
  ],
  tc_session_resumed: ["sessionId", "resumeSource"],
  tc_session_completed: [
    "sessionId",
    "sessionMode",
    "focusConceptId",
    "completedTaskCount",
    "correctCount",
    "incorrectCount",
  ],
  tc_summary_viewed: ["sessionId", "sessionMode", "focusConceptId"],
};

@Injectable()
export class TelemetryService {
  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(
    input: TelemetryInput,
    client: TelemetryClient = this.prisma,
  ) {
    const normalized = await this.normalizeAndValidate(input, client);

    await client.telemetryEvent.create({
      data: {
        eventName: normalized.eventName,
        occurredAt: normalized.occurredAt,
        learnerId: normalized.learnerId,
        route: normalized.route,
        sessionId: normalized.sessionId,
        sessionItemId: normalized.sessionItemId,
        properties: normalized.properties,
      },
    });

    return { recorded: true };
  }

  private async normalizeAndValidate(
    input: TelemetryInput,
    client: TelemetryClient,
  ) {
    if (!input.learnerId) {
      throw new BadRequestException("Missing telemetry learnerId");
    }

    if (!input.route) {
      throw new BadRequestException("Missing telemetry route");
    }

    const requiredProperties = requiredPropertyMap[input.eventName];

    if (!requiredProperties) {
      throw new BadRequestException("Invalid telemetry event");
    }

    const properties = Object.fromEntries(
      Object.entries(input.properties).map(([key, value]) => [
        key,
        this.toJsonValue(value),
      ]),
    ) as Record<string, Prisma.JsonValue>;
    const sessionId =
      input.sessionId ?? this.readString(properties.sessionId) ?? null;
    const sessionItemId =
      input.sessionItemId ?? this.readString(properties.sessionItemId) ?? null;

    if (
      input.eventName === "tc_diagnostic_answer_submitted" ||
      input.eventName === "tc_session_answer_submitted"
    ) {
      const primaryErrorTag =
        this.readString(properties.primaryErrorTag) ??
        (await this.findPrimaryErrorTag({
          client,
          learnerId: input.learnerId,
          sessionId,
          sessionItemId,
        }));

      properties.primaryErrorTag = primaryErrorTag;
    }

    if (input.eventName === "tc_session_help_revealed") {
      const helpKind = this.readString(properties.helpKind);

      if (!helpKind || !Object.values(HelpKind).includes(helpKind as HelpKind)) {
        throw new BadRequestException("Invalid telemetry helpKind");
      }

      await this.markHintRevealed({
        client,
        learnerId: input.learnerId,
        sessionId,
        sessionItemId,
        helpKind: helpKind as HelpKind,
      });
    }

    const propertyKeys = Object.keys(properties);

    if (
      propertyKeys.length !== requiredProperties.length ||
      propertyKeys.some((key) => !requiredProperties.includes(key))
    ) {
      throw new BadRequestException("Invalid telemetry properties");
    }

    for (const propertyName of requiredProperties) {
      if (!(propertyName in properties)) {
        throw new BadRequestException("Missing telemetry property");
      }
    }

    return {
      eventName: input.eventName,
      learnerId: input.learnerId,
      route: input.route,
      sessionId,
      sessionItemId,
      occurredAt: input.occurredAt ?? new Date(),
      properties,
    };
  }

  private async findPrimaryErrorTag(input: {
    client: TelemetryClient;
    learnerId: string;
    sessionId: string | null;
    sessionItemId: string | null;
  }) {
    if (!input.sessionId || !input.sessionItemId) {
      return null;
    }

    const attempt = await input.client.attempt.findFirst({
      where: {
        learnerId: input.learnerId,
        sessionId: input.sessionId,
        sessionItemId: input.sessionItemId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        primaryErrorTag: true,
      },
    });

    return attempt?.primaryErrorTag ?? null;
  }

  private async markHintRevealed(input: {
    client: TelemetryClient;
    learnerId: string;
    sessionId: string | null;
    sessionItemId: string | null;
    helpKind: HelpKind;
  }) {
    if (!input.sessionId || !input.sessionItemId) {
      throw new BadRequestException("Missing telemetry session pointers");
    }

    const attempt = await input.client.attempt.findFirst({
      where: {
        learnerId: input.learnerId,
        sessionId: input.sessionId,
        sessionItemId: input.sessionItemId,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
      },
    });

    if (!attempt) {
      throw new BadRequestException("Missing attempt for telemetry hint event");
    }

    await input.client.attempt.update({
      where: {
        id: attempt.id,
      },
      data: {
        helpKindUsed: input.helpKind,
      },
    });
  }

  private readString(value: unknown) {
    return typeof value === "string" ? value : null;
  }

  private toJsonValue(value: unknown): Prisma.JsonValue {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    throw new BadRequestException("Invalid telemetry value");
  }
}
