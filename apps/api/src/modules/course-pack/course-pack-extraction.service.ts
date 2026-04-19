import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CoursePack,
  CoursePackReadinessState,
  SourceDocument,
  SourceDocumentParseStatus,
  SourceDocumentValidationStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CoursePackBlueprintService } from "./course-pack-blueprint.service";
import { CoursePackDocumentReaderService } from "./course-pack-document-reader.service";
import { CoursePackDriftService } from "./course-pack-drift.service";
import { CoursePackExtractionEngineService } from "./course-pack-extraction-engine.service";
import { CoursePackGraphService } from "./course-pack-graph.service";
import { mapCoursePackExtractionResponse } from "./course-pack.mapper";
import {
  COURSE_PACK_CONFIRMATION_INCLUDE,
  COURSE_PACK_EXTRACTION_INCLUDE,
  ConfirmationSnapshotWithRelations,
  CoursePackExtractionSnapshotWithRelations,
} from "./course-pack.query";
import { CoursePackSupportLevelService } from "./course-pack-support-level.service";

@Injectable()
export class CoursePackExtractionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursePackDocumentReaderService: CoursePackDocumentReaderService,
    private readonly coursePackExtractionEngineService: CoursePackExtractionEngineService,
    private readonly coursePackGraphService: CoursePackGraphService,
    private readonly coursePackBlueprintService: CoursePackBlueprintService,
    private readonly coursePackSupportLevelService: CoursePackSupportLevelService,
    private readonly coursePackDriftService: CoursePackDriftService,
  ) {}

  async runExtraction(input: { learnerId: string; coursePackId: string }) {
    const coursePack = await this.getOwnedCoursePack(input.coursePackId, input.learnerId);
    this.assertExtractionReady(coursePack);
    const baselineConfirmationSnapshot =
      await this.getLatestValidConfirmationSnapshot(coursePack.id);
    const baselineDocumentsAtExtraction = baselineConfirmationSnapshot
      ? await this.loadDocumentsActiveAt(
          coursePack.id,
          baselineConfirmationSnapshot.extractionSnapshot.generatedAt,
        )
      : [];

    const parseableDocuments = coursePack.sourceDocuments.filter(
      (document) =>
        document.validationStatus === SourceDocumentValidationStatus.valid &&
        (document.parseStatus === SourceDocumentParseStatus.parsed ||
          document.parseStatus === SourceDocumentParseStatus.partial),
    );

    if (parseableDocuments.length === 0) {
      throw new BadRequestException("No parseable documents available for extraction");
    }

    await this.prisma.coursePack.update({
      where: { id: coursePack.id },
      data: {
        lifecycleState: "extracting",
      },
    });

    try {
      const parsedDocuments = await Promise.all(
        parseableDocuments.map((document) =>
          this.coursePackDocumentReaderService.readDocument(document),
        ),
      );
      const artifact =
        this.coursePackExtractionEngineService.createArtifact(parsedDocuments);
      const graph = this.coursePackGraphService.buildGraph(artifact);
      const blueprint = this.coursePackBlueprintService.buildBlueprint(
        artifact,
        graph,
      );
      const assessment =
        this.coursePackSupportLevelService.buildCandidateAssessment({
          documents: parseableDocuments,
          artifact,
          graph,
          blueprint,
        });
      const extractionSnapshot = await this.prisma.$transaction(async (tx) => {
        const nextGraphVersion =
          (await tx.courseGraph.count({
            where: {
              coursePackId: coursePack.id,
            },
          })) + 1;
        const snapshot = await tx.extractionSnapshot.create({
          data: {
            coursePackId: coursePack.id,
            coverageStatus: artifact.coverageStatus,
            averageConfidenceScore: artifact.averageConfidenceScore,
            documentCount: parseableDocuments.length,
            lowConfidenceItemCount: artifact.lowConfidenceItemCount,
            warningCodes: artifact.warningCodes,
          },
        });
        const sourceEvidenceIdByTempId = new Map<string, string>();

        for (const evidence of artifact.sourceEvidences) {
          const created = await tx.sourceEvidence.create({
            data: {
              extractionSnapshotId: snapshot.id,
              documentId: evidence.documentId,
              pageStart: evidence.pageStart,
              pageEnd: evidence.pageEnd,
              evidenceType: evidence.evidenceType,
              snippet: evidence.snippet,
            },
          });
          sourceEvidenceIdByTempId.set(evidence.tempId, created.id);
        }

        const unitIdByTempId = new Map<string, string>();

        for (const unit of artifact.units) {
          const created = await tx.extractedUnitCandidate.create({
            data: {
              extractionSnapshotId: snapshot.id,
              rawTitle: unit.rawTitle,
              normalizedTitle: unit.normalizedTitle,
              sequenceOrderCandidate: unit.sequenceOrderCandidate,
              importanceTierCandidate: unit.importanceTierCandidate,
              confidenceScore: unit.confidenceScore,
              sourceEvidenceIds: mapEvidenceIds(
                unit.sourceEvidenceTempIds,
                sourceEvidenceIdByTempId,
              ),
            },
          });
          unitIdByTempId.set(unit.tempId, created.id);
        }

        const conceptIdByTempId = new Map<string, string>();

        for (const concept of artifact.concepts) {
          const created = await tx.extractedConceptCandidate.create({
            data: {
              extractionSnapshotId: snapshot.id,
              unitCandidateId: concept.unitTempId
                ? unitIdByTempId.get(concept.unitTempId) ?? null
                : null,
              rawLabel: concept.rawLabel,
              learnerLabelCandidate: concept.learnerLabelCandidate,
              sequenceOrderCandidate: concept.sequenceOrderCandidate,
              difficultyTierCandidate: concept.difficultyTierCandidate,
              importanceTierCandidate: concept.importanceTierCandidate,
              assessmentRelevanceCandidate: concept.assessmentRelevanceCandidate,
              canonicalMappingCandidate: concept.canonicalMappingCandidate,
              mappingConfidenceScore: concept.mappingConfidenceScore,
              coachabilityStatus: concept.coachabilityStatus,
              sourceEvidenceIds: mapEvidenceIds(
                concept.sourceEvidenceTempIds,
                sourceEvidenceIdByTempId,
              ),
            },
          });
          conceptIdByTempId.set(concept.tempId, created.id);
        }

        const dependencyIdByTempId = new Map<string, string>();

        for (const dependency of artifact.dependencyCandidates) {
          const fromConceptCandidateId = conceptIdByTempId.get(
            dependency.fromConceptTempId,
          );
          const toConceptCandidateId = conceptIdByTempId.get(
            dependency.toConceptTempId,
          );

          if (!fromConceptCandidateId || !toConceptCandidateId) {
            continue;
          }

          const created = await tx.extractedDependencyCandidate.create({
            data: {
              extractionSnapshotId: snapshot.id,
              fromConceptCandidateId,
              toConceptCandidateId,
              edgeType: dependency.edgeType,
              confidenceScore: dependency.confidenceScore,
              sourceEvidenceIds: mapEvidenceIds(
                dependency.sourceEvidenceTempIds,
                sourceEvidenceIdByTempId,
              ),
            },
          });
          dependencyIdByTempId.set(dependency.tempId, created.id);
        }

        for (const theme of artifact.recurringThemes) {
          await tx.recurringTheme.create({
            data: {
              extractionSnapshotId: snapshot.id,
              label: theme.label,
              frequencyScore: theme.frequencyScore,
              relatedConceptCandidateIds: theme.relatedConceptTempIds
                .map((tempId) => conceptIdByTempId.get(tempId))
                .filter((value): value is string => Boolean(value)),
              sourceEvidenceIds: mapEvidenceIds(
                theme.sourceEvidenceTempIds,
                sourceEvidenceIdByTempId,
              ),
            },
          });
        }

        for (const unsupportedTopic of artifact.unsupportedTopics) {
          await tx.unsupportedTopic.create({
            data: {
              extractionSnapshotId: snapshot.id,
              rawLabel: unsupportedTopic.rawLabel,
              reasonCode: unsupportedTopic.reasonCode,
              sourceEvidenceIds: mapEvidenceIds(
                unsupportedTopic.sourceEvidenceTempIds,
                sourceEvidenceIdByTempId,
              ),
              suggestedHandling: unsupportedTopic.suggestedHandling,
            },
          });
        }

        const createdGraph = await tx.courseGraph.create({
          data: {
            coursePackId: coursePack.id,
            extractionSnapshotId: snapshot.id,
            version: nextGraphVersion,
            averageConfidenceScore: graph.averageConfidenceScore,
          },
        });
        const graphUnitIdBySourceTempId = new Map<string, string>();

        for (const unit of graph.units) {
          const sourceUnitCandidateId = unitIdByTempId.get(unit.sourceUnitTempId);

          if (!sourceUnitCandidateId || unit.sourceEvidenceIds.length === 0) {
            continue;
          }

          const created = await tx.courseGraphUnit.create({
            data: {
              courseGraphId: createdGraph.id,
              sourceUnitCandidateId,
              label: unit.label,
              sequenceOrder: unit.sequenceOrder,
              importanceTier: unit.importanceTier,
              confidenceScore: unit.confidenceScore,
              sourceEvidenceIds: mapEvidenceIds(
                unit.sourceEvidenceIds,
                sourceEvidenceIdByTempId,
              ),
            },
          });
          graphUnitIdBySourceTempId.set(unit.sourceUnitTempId, created.id);
        }

        const graphConceptIdBySourceTempId = new Map<string, string>();

        for (const concept of graph.concepts) {
          const sourceConceptCandidateId = conceptIdByTempId.get(
            concept.sourceConceptTempId,
          );

          if (!sourceConceptCandidateId || concept.sourceEvidenceIds.length === 0) {
            continue;
          }

          const created = await tx.courseGraphConcept.create({
            data: {
              courseGraphId: createdGraph.id,
              sourceConceptCandidateId,
              unitId: concept.unitSourceTempId
                ? graphUnitIdBySourceTempId.get(concept.unitSourceTempId) ?? null
                : null,
              label: concept.label,
              normalizedLabel: concept.normalizedLabel,
              sequenceOrder: concept.sequenceOrder,
              difficultyTier: concept.difficultyTier,
              importanceTier: concept.importanceTier,
              assessmentRelevance: concept.assessmentRelevance,
              coachabilityStatus: concept.coachabilityStatus,
              canonicalTemplateId: concept.canonicalTemplateId,
              mappingConfidenceScore: concept.mappingConfidenceScore,
              mergedSourceConceptCandidateIds: concept.mergedSourceConceptTempIds
                .map((tempId) => conceptIdByTempId.get(tempId))
                .filter((value): value is string => Boolean(value)),
              sourceEvidenceIds: mapEvidenceIds(
                concept.sourceEvidenceIds,
                sourceEvidenceIdByTempId,
              ),
              confidenceScore: concept.confidenceScore,
            },
          });
          graphConceptIdBySourceTempId.set(concept.sourceConceptTempId, created.id);
        }

        for (const edge of graph.edges) {
          const sourceDependencyCandidateId = dependencyIdByTempId.get(
            edge.sourceDependencyTempId,
          );
          const fromConceptId = graphConceptIdBySourceTempId.get(
            edge.fromConceptSourceTempId,
          );
          const toConceptId = graphConceptIdBySourceTempId.get(
            edge.toConceptSourceTempId,
          );

          if (
            !sourceDependencyCandidateId ||
            !fromConceptId ||
            !toConceptId ||
            edge.sourceEvidenceIds.length === 0
          ) {
            continue;
          }

          await tx.courseGraphEdge.create({
            data: {
              courseGraphId: createdGraph.id,
              sourceDependencyCandidateId,
              fromConceptId,
              toConceptId,
              edgeType: edge.edgeType,
              confidenceScore: edge.confidenceScore,
              sourceEvidenceIds: mapEvidenceIds(
                edge.sourceEvidenceIds,
                sourceEvidenceIdByTempId,
              ),
            },
          });
        }

        const createdBlueprint = await tx.examBlueprint.create({
          data: {
            coursePackId: coursePack.id,
            extractionSnapshotId: snapshot.id,
            averageConfidenceScore: blueprint.averageConfidenceScore,
          },
        });

        for (const area of blueprint.areas) {
          await tx.examBlueprintArea.create({
            data: {
              examBlueprintId: createdBlueprint.id,
              label: area.label,
              unitIds: area.unitSourceTempIds
                .map((tempId) => graphUnitIdBySourceTempId.get(tempId))
                .filter((value): value is string => Boolean(value)),
              conceptIds: area.conceptSourceTempIds
                .map((tempId) => graphConceptIdBySourceTempId.get(tempId))
                .filter((value): value is string => Boolean(value)),
              priorityTier: area.priorityTier,
              practiceNeed: area.practiceNeed,
              recurrenceSignal: area.recurrenceSignal,
              suggestedTimeSharePct: area.suggestedTimeSharePct,
              confidenceScore: area.confidenceScore,
              reasonCodes: area.reasonCodes,
              sourceEvidenceIds: mapEvidenceIds(
                area.sourceEvidenceIds,
                sourceEvidenceIdByTempId,
              ),
            },
          });
        }

        await tx.supportLevelAssessment.create({
          data: {
            coursePackId: coursePack.id,
            extractionSnapshotId: snapshot.id,
            parseIntegrityScore: assessment.parseIntegrityScore,
            structureConfidenceScore: assessment.structureConfidenceScore,
            blueprintConfidenceScore: assessment.blueprintConfidenceScore,
            packCompletenessScore: assessment.packCompletenessScore,
            coachableCoverageScore: assessment.coachableCoverageScore,
            evaluationReliabilityScore: assessment.evaluationReliabilityScore,
            candidateSupportLevel: assessment.candidateSupportLevel,
          },
        });

        return tx.extractionSnapshot.findUniqueOrThrow({
          where: {
            id: snapshot.id,
          },
          include: COURSE_PACK_EXTRACTION_INCLUDE,
        });
      });

      const driftState = this.coursePackDriftService.assessExtractionDrift({
        isActive: coursePack.isActive,
        latestExtractionSnapshot: extractionSnapshot,
        baselineConfirmationSnapshot,
        currentActiveDocuments: coursePack.sourceDocuments,
        baselineDocumentsAtExtraction,
      });
      const hasBaselineConfirmation = Boolean(baselineConfirmationSnapshot);
      const lifecycleState = hasBaselineConfirmation
        ? driftState.requiresReconfirmation
          ? coursePack.isActive
            ? "active"
            : "awaiting_confirmation"
          : coursePack.isActive
            ? "active"
            : "confirmed"
        : "awaiting_confirmation";
      const readinessState =
        hasBaselineConfirmation && !driftState.requiresReconfirmation
          ? "activation_ready"
          : "review_ready";

      await this.prisma.coursePack.update({
        where: {
          id: coursePack.id,
        },
        data: {
          lifecycleState,
          readinessState,
          supportLevelCandidate: assessment.candidateSupportLevel,
          unsupportedTopicCount: artifact.unsupportedTopics.length,
          driftStatus: driftState.driftStatus,
          driftReasonCodes: driftState.driftReasonCodes,
          requiresReconfirmation: driftState.requiresReconfirmation,
          activeContextState: driftState.activeContextState,
          activeConfirmationSnapshotId:
            hasBaselineConfirmation && !driftState.requiresReconfirmation
              ? baselineConfirmationSnapshot?.id
              : coursePack.activeConfirmationSnapshotId,
        },
      });

      return mapCoursePackExtractionResponse(extractionSnapshot);
    } catch (error) {
      await this.prisma.coursePack.update({
        where: { id: coursePack.id },
        data: {
          lifecycleState: coursePack.lifecycleState,
          readinessState: coursePack.readinessState,
        },
      });
      throw error;
    }
  }

  async getLatestExtraction(input: { learnerId: string; coursePackId: string }) {
    await this.getOwnedCoursePack(input.coursePackId, input.learnerId);

    const extractionSnapshot = await this.prisma.extractionSnapshot.findFirst({
      where: {
        coursePackId: input.coursePackId,
      },
      include: COURSE_PACK_EXTRACTION_INCLUDE,
      orderBy: {
        generatedAt: "desc",
      },
    });

    if (!extractionSnapshot) {
      throw new NotFoundException("Extraction snapshot not found");
    }

    return mapCoursePackExtractionResponse(extractionSnapshot);
  }

  private assertExtractionReady(
    coursePack: CoursePack & {
      sourceDocuments: SourceDocument[];
    },
  ) {
    if (
      coursePack.readinessState !== CoursePackReadinessState.awaiting_extraction &&
      coursePack.readinessState !== CoursePackReadinessState.review_ready
    ) {
      throw new BadRequestException("Course pack is not ready for extraction");
    }
  }

  private async getOwnedCoursePack(coursePackId: string, learnerId: string) {
    const coursePack = await this.prisma.coursePack.findFirst({
      where: {
        id: coursePackId,
        learnerId,
      },
      include: {
        sourceDocuments: {
          where: {
            removedAt: null,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!coursePack) {
      throw new NotFoundException("Course pack not found");
    }

    return coursePack;
  }

  private async getLatestValidConfirmationSnapshot(coursePackId: string) {
    return this.prisma.confirmationSnapshot.findFirst({
      where: {
        coursePackId,
        status: {
          in: ["confirmed", "activated"],
        },
      },
      include: COURSE_PACK_CONFIRMATION_INCLUDE,
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  private async loadDocumentsActiveAt(coursePackId: string, timestamp: Date) {
    return this.prisma.sourceDocument.findMany({
      where: {
        coursePackId,
        uploadedAt: {
          lte: timestamp,
        },
        OR: [
          {
            removedAt: null,
          },
          {
            removedAt: {
              gt: timestamp,
            },
          },
        ],
      },
      orderBy: {
        uploadedAt: "asc",
      },
    });
  }
}

function mapEvidenceIds(
  sourceEvidenceTempIds: string[],
  sourceEvidenceIdByTempId: Map<string, string>,
) {
  return sourceEvidenceTempIds
    .map((tempId) => sourceEvidenceIdByTempId.get(tempId))
    .filter((value): value is string => Boolean(value));
}
