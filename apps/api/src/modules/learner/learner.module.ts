import { Module } from "@nestjs/common";
import { CurriculumModule } from "../curriculum/curriculum.module";
import { LearnerProgressService } from "./learner-progress.service";
import { ProgrammingPlannerService } from "./programming-planner.service";

@Module({
  imports: [CurriculumModule],
  providers: [LearnerProgressService, ProgrammingPlannerService],
  exports: [LearnerProgressService, ProgrammingPlannerService],
})
export class LearnerModule {}
