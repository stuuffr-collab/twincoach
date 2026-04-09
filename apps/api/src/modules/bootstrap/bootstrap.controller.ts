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
      examDate?: string;
      activeUnitId?: string;
    },
  ) {
    if (!body.examDate || !isValidCalendarDate(body.examDate)) {
      throw new BadRequestException("Invalid examDate");
    }

    if (!body.activeUnitId) {
      throw new BadRequestException("Invalid activeUnitId");
    }

    return this.bootstrapService.completeOnboarding({
      learnerId,
      examDate: body.examDate,
      activeUnitId: body.activeUnitId,
    });
  }
}

function isValidCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
