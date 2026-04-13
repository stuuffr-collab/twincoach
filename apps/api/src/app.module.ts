import { AdminModule } from "./modules/admin/admin.module";
import { Module } from "@nestjs/common";
import { BootstrapModule } from "./modules/bootstrap/bootstrap.module";
import { CurriculumModule } from "./modules/curriculum/curriculum.module";
import { LearnerModule } from "./modules/learner/learner.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SessionModule } from "./modules/session/session.module";
import { TelemetryModule } from "./modules/telemetry/telemetry.module";

@Module({
  imports: [
    PrismaModule,
    AdminModule,
    BootstrapModule,
    LearnerModule,
    CurriculumModule,
    SessionModule,
    TelemetryModule,
  ],
})
export class AppModule {}
