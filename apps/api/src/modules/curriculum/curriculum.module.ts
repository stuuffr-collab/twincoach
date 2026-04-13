import { Module } from "@nestjs/common";
import { CurriculumService } from "./curriculum.service";
import { ProgrammingFixtureService } from "./programming-fixture.service";

@Module({
  providers: [CurriculumService, ProgrammingFixtureService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
