import { Module } from "@nestjs/common";
import { LearnerProgressService } from "./learner-progress.service";

@Module({
  providers: [LearnerProgressService],
  exports: [LearnerProgressService],
})
export class LearnerModule {}
