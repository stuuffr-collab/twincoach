import { Injectable } from "@nestjs/common";
import {
  CoursePackActiveContextState,
  CoursePackDriftStatus,
  SourceDocument,
  SourceDocumentRole,
} from "@prisma/client";
import {
  ConfirmationSnapshotWithRelations,
  CoursePackExtractionSnapshotWithRelations,
} from "./course-pack.query";

export type CoursePackDriftCode =
  | "documents_added"
  | "documents_removed"
  | "documents_replaced"
  | "document_roles_changed"
  | "course_graph_changed"
  | "exam_blueprint_changed"
  | "support_level_changed"
  | "activation_refresh_required";

export type CoursePackDriftSnapshot = {
  driftStatus: CoursePackDriftStatus;
  driftReasonCodes: CoursePackDriftCode[];
  requiresReconfirmation: boolean;
  activeContextState: CoursePackActiveContextState;
};

@Injectable()
export class CoursePackDriftService {
  buildPendingRefreshState(input: {
    isActive: boolean;
    reasonCodes: CoursePackDriftCode[];
  }): CoursePackDriftSnapshot {
    return {
      driftStatus: CoursePackDriftStatus.pending_refresh,
      driftReasonCodes: uniqueCodes(input.reasonCodes),
      requiresReconfirmation: false,
      activeContextState: input.isActive
        ? CoursePackActiveContextState.stale
        : CoursePackActiveContextState.current,
    };
  }

  buildPostConfirmationState(input: {
    isActive: boolean;
  }): CoursePackDriftSnapshot {
    if (input.isActive) {
      return {
        driftStatus: CoursePackDriftStatus.clean,
        driftReasonCodes: ["activation_refresh_required"],
        requiresReconfirmation: false,
        activeContextState: CoursePackActiveContextState.stale,
      };
    }

    return {
      driftStatus: CoursePackDriftStatus.clean,
      driftReasonCodes: [],
      requiresReconfirmation: false,
      activeContextState: CoursePackActiveContextState.current,
    };
  }

  buildCleanState(input: {
    isActive: boolean;
  }): CoursePackDriftSnapshot {
    return {
      driftStatus: CoursePackDriftStatus.clean,
      driftReasonCodes: [],
      requiresReconfirmation: false,
      activeContextState: input.isActive
        ? CoursePackActiveContextState.current
        : CoursePackActiveContextState.current,
    };
  }

  assessExtractionDrift(input: {
    isActive: boolean;
    latestExtractionSnapshot: CoursePackExtractionSnapshotWithRelations;
    baselineConfirmationSnapshot: ConfirmationSnapshotWithRelations | null;
    currentActiveDocuments: SourceDocument[];
    baselineDocumentsAtExtraction: SourceDocument[];
  }): CoursePackDriftSnapshot {
    if (!input.baselineConfirmationSnapshot) {
      return this.buildCleanState({
        isActive: input.isActive,
      });
    }

    const baselineExtraction = input.baselineConfirmationSnapshot.extractionSnapshot;
    const latestSupportLevel =
      input.latestExtractionSnapshot.supportLevelAssessment?.candidateSupportLevel ??
      "not_ready";
    const baselineSupportLevel =
      baselineExtraction.supportLevelAssessment?.candidateSupportLevel ??
      "not_ready";

    const driftReasonCodes: CoursePackDriftCode[] = [];

    if (
      createDocumentRoleSignature(input.currentActiveDocuments) !==
      createDocumentRoleSignature(input.baselineDocumentsAtExtraction)
    ) {
      driftReasonCodes.push("document_roles_changed");
    }

    if (
      createGraphSignature(input.latestExtractionSnapshot) !==
      createGraphSignature(baselineExtraction)
    ) {
      driftReasonCodes.push("course_graph_changed");
    }

    if (
      createBlueprintSignature(input.latestExtractionSnapshot) !==
      createBlueprintSignature(baselineExtraction)
    ) {
      driftReasonCodes.push("exam_blueprint_changed");
    }

    if (latestSupportLevel !== baselineSupportLevel) {
      driftReasonCodes.push("support_level_changed");
    }

    const requiresReconfirmation = driftReasonCodes.some((code) =>
      [
        "course_graph_changed",
        "exam_blueprint_changed",
        "support_level_changed",
      ].includes(code),
    );

    if (!requiresReconfirmation) {
      return this.buildCleanState({
        isActive: input.isActive,
      });
    }

    return {
      driftStatus: CoursePackDriftStatus.review_required,
      driftReasonCodes: uniqueCodes(driftReasonCodes),
      requiresReconfirmation: true,
      activeContextState: input.isActive
        ? CoursePackActiveContextState.stale
        : CoursePackActiveContextState.current,
    };
  }
}

function createDocumentRoleSignature(documents: SourceDocument[]) {
  return documents
    .map((document) => resolveDocumentRole(document))
    .sort()
    .join("|");
}

function resolveDocumentRole(document: SourceDocument) {
  return (
    document.confirmedRole ??
    document.suggestedRole ??
    SourceDocumentRole.unknown
  );
}

function createGraphSignature(
  extractionSnapshot: CoursePackExtractionSnapshotWithRelations,
) {
  const graph = extractionSnapshot.courseGraph;

  if (!graph) {
    return "no-graph";
  }

  const unitLabelsById = new Map(
    graph.units.map((unit) => [unit.id, normalizeValue(unit.label)] as const),
  );
  const unitSignature = graph.units
    .slice()
    .sort((left, right) => left.sequenceOrder - right.sequenceOrder)
    .map(
      (unit) =>
        `${unit.sequenceOrder}:${normalizeValue(unit.label)}:${unit.importanceTier}`,
    )
    .join("|");
  const conceptSignature = graph.concepts
    .slice()
    .sort((left, right) => left.sequenceOrder - right.sequenceOrder)
    .map((concept) => {
      const unitLabel = concept.unitId
        ? unitLabelsById.get(concept.unitId) ?? "none"
        : "none";

      return [
        concept.sequenceOrder,
        unitLabel,
        normalizeValue(concept.normalizedLabel || concept.label),
        concept.assessmentRelevance,
        concept.coachabilityStatus,
        concept.canonicalTemplateId ?? "none",
      ].join(":");
    })
    .join("|");
  const conceptLabelById = new Map(
    graph.concepts.map(
      (concept) =>
        [
          concept.id,
          normalizeValue(concept.normalizedLabel || concept.label),
        ] as const,
    ),
  );
  const edgeSignature = graph.edges
    .slice()
    .sort((left, right) => {
      const leftKey = [
        conceptLabelById.get(left.fromConceptId) ?? "none",
        conceptLabelById.get(left.toConceptId) ?? "none",
        left.edgeType,
      ].join(":");
      const rightKey = [
        conceptLabelById.get(right.fromConceptId) ?? "none",
        conceptLabelById.get(right.toConceptId) ?? "none",
        right.edgeType,
      ].join(":");

      return leftKey.localeCompare(rightKey);
    })
    .map((edge) =>
      [
        conceptLabelById.get(edge.fromConceptId) ?? "none",
        conceptLabelById.get(edge.toConceptId) ?? "none",
        edge.edgeType,
      ].join(":"),
    )
    .join("|");

  return [unitSignature, conceptSignature, edgeSignature].join("||");
}

function createBlueprintSignature(
  extractionSnapshot: CoursePackExtractionSnapshotWithRelations,
) {
  const blueprint = extractionSnapshot.examBlueprint;

  if (!blueprint) {
    return "no-blueprint";
  }

  return blueprint.areas
    .slice()
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((area) =>
      [
        normalizeValue(area.label),
        area.priorityTier,
        area.practiceNeed,
        area.recurrenceSignal,
        area.suggestedTimeSharePct,
      ].join(":"),
    )
    .join("|");
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function uniqueCodes(codes: CoursePackDriftCode[]) {
  return [...new Set(codes)];
}
