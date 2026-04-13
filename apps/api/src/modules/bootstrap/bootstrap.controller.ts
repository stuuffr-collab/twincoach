import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
} from "@nestjs/common";
import { BootstrapService } from "./bootstrap.service";

@Controller()
export class BootstrapController {
  constructor(private readonly bootstrapService: BootstrapService) {}

  @Get("health")
  getHealth() {
    return { status: "ok" };
  }

  @Get("boot")
  getBoot(@Headers("x-learner-id") learnerId?: string) {
    return this.bootstrapService.getBootState(learnerId);
  }

  @Get("today")
  getToday(@Headers("x-learner-id") learnerId?: string) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    return this.bootstrapService.getTodaySummary(learnerId);
  }

  @Post("onboarding/complete")
  completeOnboarding(
    @Headers("x-learner-id") learnerId: string | undefined,
    @Body()
    body: {
      priorProgrammingExposure?: string;
      currentComfortLevel?: string;
      biggestDifficulty?: string;
      preferredHelpStyle?: string;
    },
  ) {
    const allowedKeys = [
      "priorProgrammingExposure",
      "currentComfortLevel",
      "biggestDifficulty",
      "preferredHelpStyle",
    ];

    const bodyKeys = Object.keys(body);

    if (
      bodyKeys.length !== allowedKeys.length ||
      bodyKeys.some((key) => !allowedKeys.includes(key))
    ) {
      throw new BadRequestException("Invalid onboarding payload");
    }

    if (
      !isAllowedValue(body.priorProgrammingExposure, [
        "none",
        "school_basics",
        "self_taught_basics",
        "completed_intro_course",
      ])
    ) {
      throw new BadRequestException("Invalid priorProgrammingExposure");
    }

    if (
      !isAllowedValue(body.currentComfortLevel, ["very_low", "low", "medium"])
    ) {
      throw new BadRequestException("Invalid currentComfortLevel");
    }

    if (
      !isAllowedValue(body.biggestDifficulty, [
        "reading_code",
        "writing_syntax",
        "tracing_logic",
        "debugging_errors",
      ])
    ) {
      throw new BadRequestException("Invalid biggestDifficulty");
    }

    if (
      !isAllowedValue(body.preferredHelpStyle, [
        "step_breakdown",
        "worked_example",
        "debugging_hint",
        "concept_explanation",
      ])
    ) {
      throw new BadRequestException("Invalid preferredHelpStyle");
    }

    const priorProgrammingExposure = body.priorProgrammingExposure!;
    const currentComfortLevel = body.currentComfortLevel!;
    const biggestDifficulty = body.biggestDifficulty!;
    const preferredHelpStyle = body.preferredHelpStyle!;

    return this.bootstrapService.completeOnboarding({
      learnerId,
      priorProgrammingExposure,
      currentComfortLevel,
      biggestDifficulty,
      preferredHelpStyle,
    });
  }
}

function isAllowedValue(
  value: string | undefined,
  allowedValues: string[],
) {
  return Boolean(value && allowedValues.includes(value));
}
