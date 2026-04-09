import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from "@nestjs/common";
import { SessionService } from "./session.service";

@Controller()
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Post("diagnostic/create-or-resume")
  createOrResumeDiagnostic(@Headers("x-learner-id") learnerId?: string) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    return this.sessionService.createOrResumeDiagnostic(learnerId);
  }

  @Post("session/create-or-resume")
  createOrResumeDailySession(@Headers("x-learner-id") learnerId?: string) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    return this.sessionService.createOrResumeDailySession(learnerId);
  }

  @Get("session/:sessionId")
  getSession(
    @Param("sessionId") sessionId: string,
    @Headers("x-learner-id") learnerId?: string,
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    return this.sessionService.getSessionPayload({
      learnerId,
      sessionId,
    });
  }

  @Get("session/:sessionId/summary")
  getSessionSummary(
    @Param("sessionId") sessionId: string,
    @Headers("x-learner-id") learnerId?: string,
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    return this.sessionService.getSessionSummary({
      learnerId,
      sessionId,
    });
  }

  @Post("session/:sessionId/answer")
  submitAnswer(
    @Param("sessionId") sessionId: string,
    @Headers("x-learner-id") learnerId: string | undefined,
    @Body()
    body: {
      sessionItemId?: string;
      answerValue?: string;
      checkpointToken?: string;
    },
  ) {
    if (!learnerId) {
      throw new BadRequestException("Missing x-learner-id");
    }

    if (!body.sessionItemId || !body.answerValue || !body.checkpointToken) {
      throw new BadRequestException("Invalid answer submission");
    }

    return this.sessionService.submitAnswer({
      learnerId,
      sessionId,
      sessionItemId: body.sessionItemId,
      answerValue: body.answerValue,
      checkpointToken: body.checkpointToken,
    });
  }
}
