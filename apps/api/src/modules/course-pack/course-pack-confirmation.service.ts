import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CoursePackCoachabilityStatus,
  CoursePackSupportLevel,
  ExtractionAssessmentRelevanceTier,
  ExtractionDifficultyTier,
  ExtractionImportanceTier,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { getEngineConceptIdForCanonicalTemplate } from "./course-pack-engine-mapping";
import { CoursePackDriftService } from "./course-pack-drift.service";
import { mapCoursePackConfirmationResponse } from "./course-pack.mapper";
import {
  ConfirmationSnapshotWithRelations,
  COURSE_PACK_CONFIRMATION_INCLUDE,
  COURSE_PACK_EXTRACTION_INCLUDE,
  CoursePackExtractionSnapshotWithRelations,
} from "./course-pack.query";
import { CoursePackConfirmationPayload } from "./course-pack.types";

type ConfirmationUnitDraft = {
  sourceUnitCandidateId: string;
  sourceGraphUnitId: string | null;
  label: string;
  sequenceOrder: number;
  importanceTier: ExtractionImportanceTier;
  confidenceScore: number;
  isLowConfidence: boolean;
  sourceEvidenceIds: string[];
};

type ConfirmationConceptDraft = {
  sourceConceptCandidateId: string;
  sourceGraphConceptId: string | null;
  sourceUnitCandidateId: string | null;
  label: string;
  normalizedLabel: string;
  sequenceOrder: number;
  difficultyTier: ExtractionDifficultyTier;
  importanceTier: ExtractionImportanceTier;
  assessmentRelevance: ExtractionAssessmentRelevanceTier;
  coachabilityStatus: CoursePackCoachabilityStatus;
  canonicalTemplateId: string | null;
  engineConceptId: string | null;
  mappingConfidenceScore: number | null;
  confidenceScore: number;
  isLowConfidence: boolean;
  isExamImportant: boolean;
  mergedSourceConceptCandidateIds: string[];
  sourceEvidenceIds: string[];
  referencedBlueprintAreaIds: string[];
};

@Injectable()
export class CoursePackConfirmationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursePackDriftService: CoursePackDriftService,
  ) {}

  async createConfirmation(input: {
    learnerId: string;
    coursePackId: string;
    payload: CoursePackConfirmationPayload;
  }) {
    const coursePack = await this.getOwnedCoursePack(input.coursePackId, input.learnerId);
    const extractionSnapshot = await this.getLatestExtractionSnapshot(coursePack.id);
    const payload = normalizeConfirmationPayload(input.payload);
    const confirmationDraft = this.buildConfirmationDraft({
      extractionSnapshot,
      payload,
    });
    const confirmationSnapshot = await this.prisma.$transaction(async (tx) => {
      await tx.confirmationSnapshot.updateMany({
        where: {
          coursePackId: coursePack.id,
          status: "confirmed",
        },
        data: {
          status: "superseded",
        },
      });

      const createdSnapshot = await tx.confirmationSnapshot.create({
        data: {
          coursePackId: coursePack.id,
          extractionSnapshotId: extractionSnapshot.id,
          supportLevelCandidate:
            extractionSnapshot.supportLevelAssessment?.candidateSupportLevel ??
            CoursePackSupportLevel.not_ready,
          editedItemCount: confirmationDraft.editedItemCount,
          mergeActionCount: confirmationDraft.mergeActionCount,
          lowConfidenceAcknowledged: confirmationDraft.lowConfidenceAcknowledged,
          lowConfidenceIncludedCount: confirmationDraft.lowConfidenceIncludedCount,
        },
      });
      const unitIdBySourceUnitCandidateId = new Map<string, string>();

      for (const unit of confirmationDraft.units) {
        const createdUnit = await tx.confirmedCoursePackUnit.create({
          data: {
            confirmationSnapshotId: createdSnapshot.id,
            sourceGraphUnitId: unit.sourceGraphUnitId,
            sourceUnitCandidateId: unit.sourceUnitCandidateId,
            label: unit.label,
            sequenceOrder: unit.sequenceOrder,
            importanceTier: unit.importanceTier,
            confidenceScore: unit.confidenceScore,
            isLowConfidence: unit.isLowConfidence,
            sourceEvidenceIds: unit.sourceEvidenceIds,
          },
        });
        unitIdBySourceUnitCandidateId.set(
          unit.sourceUnitCandidateId,
          createdUnit.id,
        );
      }

      for (const concept of confirmationDraft.concepts) {
        await tx.confirmedCoursePackConcept.create({
          data: {
            confirmationSnapshotId: createdSnapshot.id,
            unitId: concept.sourceUnitCandidateId
              ? unitIdBySourceUnitCandidateId.get(concept.sourceUnitCandidateId) ??
                null
              : null,
            sourceGraphConceptId: concept.sourceGraphConceptId,
            sourceConceptCandidateId: concept.sourceConceptCandidateId,
            label: concept.label,
            normalizedLabel: concept.normalizedLabel,
            sequenceOrder: concept.sequenceOrder,
            difficultyTier: concept.difficultyTier,
            importanceTier: concept.importanceTier,
            assessmentRelevance: concept.assessmentRelevance,
            coachabilityStatus: concept.coachabilityStatus,
            canonicalTemplateId: concept.canonicalTemplateId,
            engineConceptId: concept.engineConceptId,
            mappingConfidenceScore: concept.mappingConfidenceScore,
            confidenceScore: concept.confidenceScore,
            isLowConfidence: concept.isLowConfidence,
            isExamImportant: concept.isExamImportant,
            mergedSourceConceptCandidateIds:
              concept.mergedSourceConceptCandidateIds,
            sourceEvidenceIds: concept.sourceEvidenceIds,
            referencedBlueprintAreaIds: concept.referencedBlueprintAreaIds,
          },
        });
      }

      const readinessState =
        extractionSnapshot.supportLevelAssessment?.candidateSupportLevel ===
        CoursePackSupportLevel.not_ready
          ? coursePack.readinessState
          : "activation_ready";
      const driftState = this.coursePackDriftService.buildPostConfirmationState({
        isActive: coursePack.isActive,
      });

      await tx.coursePack.update({
        where: {
          id: coursePack.id,
        },
        data: {
          lifecycleState: coursePack.isActive ? "active" : "confirmed",
          readinessState,
          activeConfirmationSnapshotId: createdSnapshot.id,
          confirmedUnitCount: confirmationDraft.units.length,
          confirmedConceptCount: confirmationDraft.concepts.length,
          confirmedAt: new Date(),
          driftStatus: driftState.driftStatus,
          driftReasonCodes: driftState.driftReasonCodes,
          requiresReconfirmation: driftState.requiresReconfirmation,
          activeContextState: driftState.activeContextState,
        },
      });

      return tx.confirmationSnapshot.findUniqueOrThrow({
        where: {
          id: createdSnapshot.id,
        },
        include: COURSE_PACK_CONFIRMATION_INCLUDE,
      });
    });

    return mapCoursePackConfirmationResponse(confirmationSnapshot);
  }

  async getLatestConfirmation(input: { learnerId: string; coursePackId: string }) {
    await this.getOwnedCoursePack(input.coursePackId, input.learnerId);

    const confirmationSnapshot = await this.prisma.confirmationSnapshot.findFirst({
      where: {
        coursePackId: input.coursePackId,
      },
      include: COURSE_PACK_CONFIRMATION_INCLUDE,
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!confirmationSnapshot) {
      throw new NotFoundException("Confirmation snapshot not found");
    }

    return mapCoursePackConfirmationResponse(confirmationSnapshot);
  }

  private buildConfirmationDraft(input: {
    extractionSnapshot: CoursePackExtractionSnapshotWithRelations;
    payload: NormalizedCoursePackConfirmationPayload;
  }) {
    const graph = input.extractionSnapshot.courseGraph;
    const blueprint = input.extractionSnapshot.examBlueprint;
    const supportLevelCandidate =
      input.extractionSnapshot.supportLevelAssessment?.candidateSupportLevel ??
      CoursePackSupportLevel.not_ready;

    if (!graph || !blueprint) {
      throw new BadRequestException("Extraction artifacts are incomplete");
    }

    const graphUnitBySourceId = new Map(
      graph.units.map((unit) => [unit.sourceUnitCandidateId, unit] as const),
    );
    const graphUnitById = new Map(graph.units.map((unit) => [unit.id, unit] as const));
    const graphConceptBySourceId = new Map(
      graph.concepts.map((concept) => [concept.sourceConceptCandidateId, concept] as const),
    );
    const extractedUnitById = new Map(
      input.extractionSnapshot.units.map((unit) => [unit.id, unit] as const),
    );
    const extractedConceptById = new Map(
      input.extractionSnapshot.concepts.map((concept) => [concept.id, concept] as const),
    );
    const baseUnitIds = new Set(graph.units.map((unit) => unit.sourceUnitCandidateId));
    const baseConceptIds = new Set(
      graph.concepts.map((concept) => concept.sourceConceptCandidateId),
    );

    const includedUnitIds = new Set(baseUnitIds);
    const includedConceptIds = new Set(baseConceptIds);

    for (const unitCandidateId of input.payload.confirmedUnitCandidateIds) {
      if (!extractedUnitById.has(unitCandidateId)) {
        throw new BadRequestException("Unknown unit candidate in confirmation");
      }
      includedUnitIds.add(unitCandidateId);
    }

    for (const conceptCandidateId of input.payload.confirmedConceptCandidateIds) {
      const extractedConcept = extractedConceptById.get(conceptCandidateId);

      if (!extractedConcept) {
        throw new BadRequestException("Unknown concept candidate in confirmation");
      }

      includedConceptIds.add(conceptCandidateId);

      if (extractedConcept.unitCandidateId) {
        includedUnitIds.add(extractedConcept.unitCandidateId);
      }
    }

    for (const removedId of [
      ...input.payload.removedItemIds,
      ...input.payload.irrelevantItemIds,
    ]) {
      includedUnitIds.delete(removedId);
      includedConceptIds.delete(removedId);
    }

    const units = [...includedUnitIds].map((sourceUnitCandidateId) => {
      const graphUnit = graphUnitBySourceId.get(sourceUnitCandidateId);
      const extractedUnit = extractedUnitById.get(sourceUnitCandidateId);

      if (!graphUnit && !extractedUnit) {
        throw new BadRequestException("Unable to resolve confirmed unit");
      }

      const labelEdit = input.payload.unitEdits.find(
        (edit) => edit.sourceUnitCandidateId === sourceUnitCandidateId,
      );
      const unit = {
        sourceUnitCandidateId,
        sourceGraphUnitId: graphUnit?.id ?? null,
        label: labelEdit?.label?.trim() || graphUnit?.label || extractedUnit!.rawTitle,
        sequenceOrder:
          graphUnit?.sequenceOrder ?? extractedUnit?.sequenceOrderCandidate ?? 1,
        importanceTier:
          graphUnit?.importanceTier ??
          extractedUnit?.importanceTierCandidate ??
          "supporting",
        confidenceScore:
          graphUnit?.confidenceScore ?? extractedUnit?.confidenceScore ?? 0,
        isLowConfidence:
          (graphUnit?.confidenceScore ?? extractedUnit?.confidenceScore ?? 0) < 0.55,
        sourceEvidenceIds:
          graphUnit?.sourceEvidenceIds ?? extractedUnit?.sourceEvidenceIds ?? [],
      } satisfies ConfirmationUnitDraft;

      if (unit.sourceEvidenceIds.length === 0) {
        throw new BadRequestException("Confirmed units require source evidence");
      }

      return unit;
    });

    const concepts = [...includedConceptIds].map((sourceConceptCandidateId) => {
      const graphConcept = graphConceptBySourceId.get(sourceConceptCandidateId);
      const extractedConcept = extractedConceptById.get(sourceConceptCandidateId);

      if (!graphConcept && !extractedConcept) {
        throw new BadRequestException("Unable to resolve confirmed concept");
      }

      const conceptLabelEdit = input.payload.conceptEdits.find(
        (edit) => edit.sourceConceptCandidateId === sourceConceptCandidateId,
      );
      const referencedBlueprintAreaIds = graphConcept
        ? blueprint.areas
            .filter((area) => area.conceptIds.includes(graphConcept.id))
            .map((area) => area.id)
        : [];
      const concept = {
        sourceConceptCandidateId,
        sourceGraphConceptId: graphConcept?.id ?? null,
        sourceUnitCandidateId:
          extractedConcept?.unitCandidateId ??
          (graphConcept?.unitId
            ? graphUnitById.get(graphConcept.unitId)?.sourceUnitCandidateId ?? null
            : null) ??
          null,
        label:
          conceptLabelEdit?.label?.trim() ||
          graphConcept?.label ||
          extractedConcept!.learnerLabelCandidate,
        normalizedLabel:
          (conceptLabelEdit?.label?.trim() ||
            graphConcept?.normalizedLabel ||
            extractedConcept!.learnerLabelCandidate
              .trim()
              .toLowerCase()) ?? "",
        sequenceOrder:
          graphConcept?.sequenceOrder ??
          extractedConcept?.sequenceOrderCandidate ??
          1,
        difficultyTier:
          graphConcept?.difficultyTier ??
          extractedConcept?.difficultyTierCandidate ??
          "unknown",
        importanceTier:
          graphConcept?.importanceTier ??
          extractedConcept?.importanceTierCandidate ??
          "supporting",
        assessmentRelevance:
          graphConcept?.assessmentRelevance ??
          extractedConcept?.assessmentRelevanceCandidate ??
          "unknown",
        coachabilityStatus:
          graphConcept?.coachabilityStatus ??
          extractedConcept?.coachabilityStatus ??
          "partially_supported",
        canonicalTemplateId:
          graphConcept?.canonicalTemplateId ??
          extractedConcept?.canonicalMappingCandidate ??
          null,
        engineConceptId: getEngineConceptIdForCanonicalTemplate(
          graphConcept?.canonicalTemplateId ??
            extractedConcept?.canonicalMappingCandidate ??
            null,
        ),
        mappingConfidenceScore:
          graphConcept?.mappingConfidenceScore ??
          extractedConcept?.mappingConfidenceScore ??
          null,
        confidenceScore:
          graphConcept?.confidenceScore ??
          inferExtractedConceptConfidence(extractedConcept),
        isLowConfidence:
          (graphConcept?.confidenceScore ??
            inferExtractedConceptConfidence(extractedConcept)) < 0.55,
        isExamImportant: input.payload.examImportantConceptIds.includes(
          sourceConceptCandidateId,
        ),
        mergedSourceConceptCandidateIds: [sourceConceptCandidateId],
        sourceEvidenceIds:
          graphConcept?.sourceEvidenceIds ??
          extractedConcept?.sourceEvidenceIds ??
          [],
        referencedBlueprintAreaIds,
      } satisfies ConfirmationConceptDraft;

      if (concept.sourceEvidenceIds.length === 0) {
        throw new BadRequestException("Confirmed concepts require source evidence");
      }

      return concept;
    });

    const conceptBySourceId = new Map(
      concepts.map((concept) => [concept.sourceConceptCandidateId, concept] as const),
    );

    for (const mergeAction of input.payload.mergeActions) {
      const target = conceptBySourceId.get(mergeAction.targetSourceConceptCandidateId);

      if (!target) {
        throw new BadRequestException("Merge target concept is missing");
      }

      for (const sourceConceptCandidateId of mergeAction.sourceConceptCandidateIds) {
        if (sourceConceptCandidateId === mergeAction.targetSourceConceptCandidateId) {
          continue;
        }

        const source = conceptBySourceId.get(sourceConceptCandidateId);

        if (!source) {
          throw new BadRequestException("Merge source concept is missing");
        }

        if (source.sourceUnitCandidateId !== target.sourceUnitCandidateId) {
          throw new BadRequestException(
            "Merged concepts must belong to the same confirmed unit",
          );
        }

        target.mergedSourceConceptCandidateIds = [
          ...new Set([
            ...target.mergedSourceConceptCandidateIds,
            ...source.mergedSourceConceptCandidateIds,
          ]),
        ];
        target.sourceEvidenceIds = [
          ...new Set([...target.sourceEvidenceIds, ...source.sourceEvidenceIds]),
        ];
        target.referencedBlueprintAreaIds = [
          ...new Set([
            ...target.referencedBlueprintAreaIds,
            ...source.referencedBlueprintAreaIds,
          ]),
        ];
        target.isExamImportant = target.isExamImportant || source.isExamImportant;
        target.isLowConfidence = target.isLowConfidence || source.isLowConfidence;
        target.confidenceScore = Math.max(
          target.confidenceScore,
          source.confidenceScore,
        );
        target.canonicalTemplateId =
          target.canonicalTemplateId ?? source.canonicalTemplateId;
        target.engineConceptId = target.engineConceptId ?? source.engineConceptId;
        target.mappingConfidenceScore = Math.max(
          target.mappingConfidenceScore ?? 0,
          source.mappingConfidenceScore ?? 0,
        );

        conceptBySourceId.delete(sourceConceptCandidateId);
      }
    }

    const survivingConcepts = [...conceptBySourceId.values()]
      .filter((concept) => {
        if (concept.sourceUnitCandidateId && !includedUnitIds.has(concept.sourceUnitCandidateId)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => left.sequenceOrder - right.sequenceOrder)
      .map((concept, index) => ({
        ...concept,
        sequenceOrder: index + 1,
      }));

    const orderedUnits = reorderUnits(units, input.payload.reorderedUnitIds).map(
      (unit, index) => ({
        ...unit,
        sequenceOrder: index + 1,
      }),
    );
    const lowConfidenceIncludedCount =
      orderedUnits.filter((unit) => unit.isLowConfidence).length +
      survivingConcepts.filter((concept) => concept.isLowConfidence).length;

    if (
      lowConfidenceIncludedCount > 0 &&
      input.payload.acknowledgeLowConfidence !== true
    ) {
      throw new BadRequestException(
        "Low-confidence items require explicit acknowledgment",
      );
    }

    return {
      supportLevelCandidate,
      units: orderedUnits,
      concepts: survivingConcepts,
      lowConfidenceIncludedCount,
      lowConfidenceAcknowledged:
        lowConfidenceIncludedCount > 0
          ? input.payload.acknowledgeLowConfidence === true
          : false,
      editedItemCount:
        input.payload.unitEdits.length +
        input.payload.conceptEdits.length +
        input.payload.removedItemIds.length +
        input.payload.irrelevantItemIds.length +
        (input.payload.reorderedUnitIds.length > 0 ? 1 : 0),
      mergeActionCount: input.payload.mergeActions.length,
    };
  }

  private async getLatestExtractionSnapshot(coursePackId: string) {
    const extractionSnapshot = await this.prisma.extractionSnapshot.findFirst({
      where: {
        coursePackId,
      },
      include: COURSE_PACK_EXTRACTION_INCLUDE,
      orderBy: {
        generatedAt: "desc",
      },
    });

    if (!extractionSnapshot) {
      throw new NotFoundException("Extraction snapshot not found");
    }

    return extractionSnapshot;
  }

  private async getOwnedCoursePack(coursePackId: string, learnerId: string) {
    const coursePack = await this.prisma.coursePack.findFirst({
      where: {
        id: coursePackId,
        learnerId,
      },
    });

    if (!coursePack) {
      throw new NotFoundException("Course pack not found");
    }

    return coursePack;
  }
}

type NormalizedCoursePackConfirmationPayload = {
  confirmedUnitCandidateIds: string[];
  confirmedConceptCandidateIds: string[];
  unitEdits: Array<{
    sourceUnitCandidateId: string;
    label: string;
  }>;
  conceptEdits: Array<{
    sourceConceptCandidateId: string;
    label: string;
  }>;
  removedItemIds: string[];
  reorderedUnitIds: string[];
  mergeActions: Array<{
    targetSourceConceptCandidateId: string;
    sourceConceptCandidateIds: string[];
  }>;
  examImportantConceptIds: string[];
  irrelevantItemIds: string[];
  acknowledgeLowConfidence: boolean;
};

function normalizeConfirmationPayload(
  payload: CoursePackConfirmationPayload,
): NormalizedCoursePackConfirmationPayload {
  return {
    confirmedUnitCandidateIds: sanitizeIds(payload.confirmedUnitCandidateIds),
    confirmedConceptCandidateIds: sanitizeIds(payload.confirmedConceptCandidateIds),
    unitEdits: (payload.unitEdits ?? [])
      .filter(
        (edit) =>
          typeof edit?.sourceUnitCandidateId === "string" &&
          typeof edit?.label === "string" &&
          edit.label.trim().length > 0,
      )
      .map((edit) => ({
        sourceUnitCandidateId: edit.sourceUnitCandidateId,
        label: edit.label.trim(),
      })),
    conceptEdits: (payload.conceptEdits ?? [])
      .filter(
        (edit) =>
          typeof edit?.sourceConceptCandidateId === "string" &&
          typeof edit?.label === "string" &&
          edit.label.trim().length > 0,
      )
      .map((edit) => ({
        sourceConceptCandidateId: edit.sourceConceptCandidateId,
        label: edit.label.trim(),
      })),
    removedItemIds: sanitizeIds(payload.removedItemIds),
    reorderedUnitIds: sanitizeIds(payload.reorderedUnitIds),
    mergeActions: (payload.mergeActions ?? [])
      .filter(
        (action) =>
          typeof action?.targetSourceConceptCandidateId === "string" &&
          Array.isArray(action?.sourceConceptCandidateIds) &&
          action.sourceConceptCandidateIds.length > 0,
      )
      .map((action) => ({
        targetSourceConceptCandidateId: action.targetSourceConceptCandidateId,
        sourceConceptCandidateIds: sanitizeIds(action.sourceConceptCandidateIds),
      })),
    examImportantConceptIds: sanitizeIds(payload.examImportantConceptIds),
    irrelevantItemIds: sanitizeIds(payload.irrelevantItemIds),
    acknowledgeLowConfidence: payload.acknowledgeLowConfidence === true,
  };
}

function sanitizeIds(value: string[] | undefined) {
  return [...new Set((value ?? []).filter((item) => typeof item === "string" && item.trim().length > 0))];
}

function reorderUnits(
  units: ConfirmationUnitDraft[],
  reorderedUnitIds: string[],
) {
  if (reorderedUnitIds.length === 0) {
    return [...units].sort((left, right) => left.sequenceOrder - right.sequenceOrder);
  }

  const unitBySourceId = new Map(
    units.map((unit) => [unit.sourceUnitCandidateId, unit] as const),
  );
  const orderedUnits: ConfirmationUnitDraft[] = [];

  for (const sourceUnitCandidateId of reorderedUnitIds) {
    const unit = unitBySourceId.get(sourceUnitCandidateId);

    if (unit) {
      orderedUnits.push(unit);
      unitBySourceId.delete(sourceUnitCandidateId);
    }
  }

  orderedUnits.push(
    ...[...unitBySourceId.values()].sort(
      (left, right) => left.sequenceOrder - right.sequenceOrder,
    ),
  );

  return orderedUnits;
}

function inferExtractedConceptConfidence(
  extractedConcept:
    | CoursePackExtractionSnapshotWithRelations["concepts"][number]
    | undefined,
) {
  if (!extractedConcept) {
    return 0;
  }

  let score = 0.5;

  if (extractedConcept.importanceTierCandidate === "core") {
    score += 0.12;
  } else if (extractedConcept.importanceTierCandidate === "supporting") {
    score += 0.08;
  }

  if (extractedConcept.assessmentRelevanceCandidate === "high") {
    score += 0.12;
  } else if (extractedConcept.assessmentRelevanceCandidate === "medium") {
    score += 0.05;
  }

  if (extractedConcept.canonicalMappingCandidate) {
    score += 0.18;
  }

  return Math.min(0.95, Math.round(score * 100) / 100);
}
