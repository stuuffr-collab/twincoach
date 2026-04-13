import { Module } from "@nestjs/common";
import { CurriculumModule } from "../curriculum/curriculum.module";
import { LearnerModule } from "../learner/learner.module";
import { TelemetryModule } from "../telemetry/telemetry.module";
import { BootstrapController } from "./bootstrap.controller";
import { BootstrapService } from "./bootstrap.service";

@Module({
  imports: [CurriculumModule, LearnerModule, TelemetryModule],
  controllers: [BootstrapController],
  providers: [BootstrapService],
})
export class BootstrapModule {}
