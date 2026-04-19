import { Module } from "@nestjs/common";
import { CoursePackActivationService } from "./course-pack-activation.service";
import { CoursePackConfirmationService } from "./course-pack-confirmation.service";
import { CoursePackContextService } from "./course-pack-context.service";
import { CoursePackController } from "./course-pack.controller";
import { CoursePackBlueprintService } from "./course-pack-blueprint.service";
import { CoursePackDocumentReaderService } from "./course-pack-document-reader.service";
import { CoursePackDriftService } from "./course-pack-drift.service";
import { CoursePackExtractionEngineService } from "./course-pack-extraction-engine.service";
import { CoursePackExtractionService } from "./course-pack-extraction.service";
import { CoursePackGraphService } from "./course-pack-graph.service";
import { CoursePackService } from "./course-pack.service";
import { CoursePackStateService } from "./course-pack-state.service";
import { CoursePackStorageService } from "./course-pack-storage.service";
import { CoursePackSupportLevelService } from "./course-pack-support-level.service";
import { DocumentRoleSuggestionService } from "./document-role-suggestion.service";
import { DocumentValidationService } from "./document-validation.service";

@Module({
  controllers: [CoursePackController],
  providers: [
    CoursePackService,
    CoursePackExtractionService,
    CoursePackStorageService,
    CoursePackDocumentReaderService,
    DocumentValidationService,
    DocumentRoleSuggestionService,
    CoursePackStateService,
    CoursePackDriftService,
    CoursePackExtractionEngineService,
    CoursePackGraphService,
    CoursePackBlueprintService,
    CoursePackSupportLevelService,
    CoursePackConfirmationService,
    CoursePackActivationService,
    CoursePackContextService,
  ],
  exports: [
    CoursePackService,
    CoursePackExtractionService,
    CoursePackContextService,
  ],
})
export class CoursePackModule {}
