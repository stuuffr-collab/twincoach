import { Module } from "@nestjs/common";
import { CoursePackModule } from "../course-pack/course-pack.module";
import { CurriculumModule } from "../curriculum/curriculum.module";
import { LearnerProgressService } from "./learner-progress.service";
import { ProgrammingPlannerService } from "./programming-planner.service";

@Module({
  imports: [CurriculumModule, CoursePackModule],
  providers: [LearnerProgressService, ProgrammingPlannerService],
  exports: [LearnerProgressService, ProgrammingPlannerService],
})
export class LearnerModule {}
