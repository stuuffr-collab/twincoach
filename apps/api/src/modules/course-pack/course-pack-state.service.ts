import {
  CoursePackLifecycleState,
  CoursePackReadinessState,
  SourceDocument,
  SourceDocumentParseStatus,
  SourceDocumentValidationStatus,
} from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { INSTRUCTIONAL_DOCUMENT_ROLES } from "./course-pack.constants";
import { CoursePackStateSnapshot } from "./course-pack.types";

@Injectable()
export class CoursePackStateService {
  deriveState(sourceDocuments: SourceDocument[]): CoursePackStateSnapshot {
    const documentCount = sourceDocuments.length;
    const parseableStatuses = new Set<SourceDocumentParseStatus>([
      SourceDocumentParseStatus.parsed,
      SourceDocumentParseStatus.partial,
    ]);

    if (documentCount === 0) {
      return {
        lifecycleState: CoursePackLifecycleState.draft,
        readinessState: CoursePackReadinessState.awaiting_documents,
        documentCount,
      };
    }

    const hasParseableDocument = sourceDocuments.some((document) =>
      parseableStatuses.has(document.parseStatus),
    );
    const hasConfirmedInstructionalRole = sourceDocuments.some((document) =>
      Boolean(
        document.validationStatus === SourceDocumentValidationStatus.valid &&
          parseableStatuses.has(document.parseStatus) &&
        document.confirmedRole &&
          INSTRUCTIONAL_DOCUMENT_ROLES.has(document.confirmedRole),
      ),
    );
    const hasValidDocument = sourceDocuments.some(
      (document) =>
        document.validationStatus === SourceDocumentValidationStatus.valid,
    );

    if (!hasValidDocument || !hasParseableDocument) {
      return {
        lifecycleState: CoursePackLifecycleState.classifying,
        readinessState: CoursePackReadinessState.blocked,
        documentCount,
      };
    }

    if (!hasConfirmedInstructionalRole) {
      return {
        lifecycleState: CoursePackLifecycleState.classifying,
        readinessState: CoursePackReadinessState.awaiting_roles,
        documentCount,
      };
    }

    return {
      lifecycleState: CoursePackLifecycleState.classifying,
      readinessState: CoursePackReadinessState.awaiting_extraction,
      documentCount,
    };
  }
}
