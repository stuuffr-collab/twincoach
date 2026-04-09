import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AdminKeyGuard } from "./admin-key.guard";
import { AdminService } from "./admin.service";

@UseGuards(AdminKeyGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("learners/recent")
  getRecentLearners() {
    return this.adminService.listRecentLearners();
  }

  @Get("learner/:learnerId")
  getLearner(@Param("learnerId") learnerId: string) {
    if (!learnerId) {
      throw new BadRequestException("Missing learnerId");
    }

    return this.adminService.getLearnerLookup(learnerId);
  }

  @Get("session/:sessionId/preview")
  getSessionPreview(@Param("sessionId") sessionId: string) {
    if (!sessionId) {
      throw new BadRequestException("Missing sessionId");
    }

    return this.adminService.getSessionPreview(sessionId);
  }

  @Post("item/:questionItemId/deactivate")
  deactivateItem(@Param("questionItemId") questionItemId: string) {
    if (!questionItemId) {
      throw new BadRequestException("Missing questionItemId");
    }

    return this.adminService.deactivateQuestionItem(questionItemId);
  }
}
