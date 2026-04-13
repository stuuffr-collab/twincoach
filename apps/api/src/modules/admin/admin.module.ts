import { Module } from "@nestjs/common";
import { CurriculumModule } from "../curriculum/curriculum.module";
import { LearnerModule } from "../learner/learner.module";
import { SessionModule } from "../session/session.module";
import { AdminKeyGuard } from "./admin-key.guard";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [CurriculumModule, LearnerModule, SessionModule],
  controllers: [AdminController],
  providers: [AdminService, AdminKeyGuard],
})
export class AdminModule {}
