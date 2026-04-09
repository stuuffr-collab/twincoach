import { Module } from "@nestjs/common";
import { CurriculumService } from "./curriculum.service";

@Module({
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
