import { Module } from "@nestjs/common";
import { CoursePackModule } from "../course-pack/course-pack.module";
import { CurriculumModule } from "../curriculum/curriculum.module";
import { LearnerModule } from "../learner/learner.module";
import { TelemetryModule } from "../telemetry/telemetry.module";
import { SessionController } from "./session.controller";
import { SessionService } from "./session.service";

@Module({
  imports: [CurriculumModule, LearnerModule, TelemetryModule, CoursePackModule],
  controllers: [SessionController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
