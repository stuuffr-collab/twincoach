import { Module } from "@nestjs/common";
import { LearnerModule } from "../learner/learner.module";
import { AdminKeyGuard } from "./admin-key.guard";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [LearnerModule],
  controllers: [AdminController],
  providers: [AdminService, AdminKeyGuard],
})
export class AdminModule {}
