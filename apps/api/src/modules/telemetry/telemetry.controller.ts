import { BadRequestException, Body, Controller, Headers, Post } from "@nestjs/common";
import { TelemetryService, type TelemetryEventName } from "./telemetry.service";

@Controller("telemetry")
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post()
  recordTelemetry(
    @Headers("x-learner-id") learnerId: string | undefined,
    @Body()
    body: {
      eventName?: string;
      route?: string;
      sessionId?: string | null;
      sessionItemId?: string | null;
      properties?: Record<string, unknown>;
    },
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!body.eventName || !body.route || !body.properties) {
      throw new BadRequestException("Invalid telemetry payload");
    }

    return this.telemetryService.recordEvent({
      eventName: body.eventName as TelemetryEventName,
      learnerId,
      route: body.route,
      sessionId: body.sessionId ?? null,
      sessionItemId: body.sessionItemId ?? null,
      properties: body.properties,
    });
  }
}
