import { Module } from "@nestjs/common";
import { CurriculumModule } from "../curriculum/curriculum.module";
import { LearnerModule } from "../learner/learner.module";
import { SessionController } from "./session.controller";
import { SessionService } from "./session.service";

@Module({
  imports: [CurriculumModule, LearnerModule],
  controllers: [SessionController],
  providers: [SessionService],
})
export class SessionModule {}
