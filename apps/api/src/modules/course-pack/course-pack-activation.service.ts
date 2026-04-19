import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CompiledCoachPackStatus,
  CoursePackCoachabilityStatus,
  CoursePackLifecycleState,
  CoursePackReadinessState,
  CoursePackSupportLevel,
  ExamBlueprintPriorityTier,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { mapCoursePackActivationResponse } from "./course-pack.mapper";
import {
  COURSE_PACK_CONFIRMATION_INCLUDE,
  ConfirmationSnapshotWithRelations,
} from "./course-pack.query";
import {
  deriveChangedConfirmedConceptIdsForRefresh,
  selectFocusCompiledConcept,
} from "./course-pack-refresh-handoff";

type CompiledConceptDraft = {
  sourceConfirmedConceptId: string;
  displayLabel: string;
  normalizedLabel: string;
  sequenceOrder: number;
  coachabilityStatus: CoursePackCoachabilityStatus;
  canonicalTemplateId: string | null;
  engineConceptId: string | null;
  priorityTier: ExamBlueprintPriorityTier;
  suggestedTimeSharePct: number;
  isExamImportant: boolean;
  sourceEvidenceIds: string[];
};

@Injectable()
export class CoursePackActivationService {
  constructor(private readonly prisma: PrismaService) {}

  async activatePack(input: {
    learnerId: string;
    coursePackId: string;
    confirmationSnapshotId?: string;
  }) {
    const coursePack = await this.prisma.coursePack.findFirst({
      where: {
        id: input.coursePackId,
        learnerId: input.learnerId,
      },
    });

    if (!coursePack) {
      throw new NotFoundException("Course pack not found");
    }

    const confirmationSnapshot = await this.loadConfirmationSnapshot({
      coursePackId: coursePack.id,
      confirmationSnapshotId: input.confirmationSnapshotId,
    });
    const previousActiveConfirmationSnapshot =
      coursePack.activeConfirmationSnapshotId &&
      coursePack.activeConfirmationSnapshotId !== confirmationSnapshot.id
        ? await this.prisma.confirmationSnapshot.findUnique({
            where: {
              id: coursePack.activeConfirmationSnapshotId,
            },
            include: COURSE_PACK_CONFIRMATION_INCLUDE,
          })
        : null;

    this.assertActivationEligibility(coursePack, confirmationSnapshot);

    if (confirmationSnapshot.compiledCoachPack) {
      const activeContext = await this.prisma.activeCourseContext.findUnique({
        where: {
          learnerId: input.learnerId,
        },
        include: {
          compiledCoachPack: {
            include: {
              concepts: true,
            },
          },
          focusCompiledConcept: true,
          coursePack: true,
        },
      });

      if (
        activeContext &&
        activeContext.compiledCoachPackId === confirmationSnapshot.compiledCoachPack.id
      ) {
        return mapCoursePackActivationResponse({
          coursePack,
          confirmationSnapshot,
          compiledCoachPack: activeContext.compiledCoachPack,
          activeCourseContext: activeContext,
        });
      }
    }

    const activationTime = new Date();
    const activationResult = await this.prisma.$transaction(async (tx) => {
      const previousActiveContext = await tx.activeCourseContext.findUnique({
        where: {
          learnerId: input.learnerId,
        },
      });

      if (previousActiveContext) {
        const previousActivePack = await tx.coursePack.findUniqueOrThrow({
          where: {
            id: previousActiveContext.coursePackId,
          },
        });

        await tx.coursePack.update({
          where: {
            id: previousActiveContext.coursePackId,
          },
          data: {
            isActive: false,
            lifecycleState: resolveInactiveLifecycleState(previousActivePack),
            readinessState: resolveInactiveReadinessState(previousActivePack),
            activeContextState: "current",
          },
        });

        await tx.compiledCoachPack.update({
          where: {
            id: previousActiveContext.compiledCoachPackId,
          },
          data: {
            compilationStatus: CompiledCoachPackStatus.superseded,
          },
        });

        await tx.confirmationSnapshot.update({
          where: {
            id: previousActiveContext.confirmationSnapshotId,
          },
          data: {
            status: "confirmed",
            activatedAt: null,
          },
        });
      }

      const compiledCoachPack = confirmationSnapshot.compiledCoachPack
        ? await this.reuseCompiledCoachPack(tx, confirmationSnapshot.compiledCoachPack.id)
        : await this.createCompiledCoachPack(tx, {
            learnerId: input.learnerId,
            coursePackId: coursePack.id,
            confirmationSnapshot,
          });
      const changedConfirmedConceptIds = deriveChangedConfirmedConceptIdsForRefresh({
        currentConfirmationSnapshot: confirmationSnapshot,
        previousConfirmationSnapshot: previousActiveConfirmationSnapshot,
      });
      const preferredFocusConcept = selectFocusCompiledConcept(
        compiledCoachPack.concepts,
        changedConfirmedConceptIds,
      );
      const focusCompiledConcept =
        confirmationSnapshot.supportLevelCandidate ===
          CoursePackSupportLevel.full_coach &&
        !preferredFocusConcept?.engineConceptId
          ? selectFocusCompiledConcept(
              compiledCoachPack.concepts.filter((concept) =>
                Boolean(concept.engineConceptId),
              ),
              changedConfirmedConceptIds,
            )
          : preferredFocusConcept;

      if (
        confirmationSnapshot.supportLevelCandidate ===
          CoursePackSupportLevel.full_coach &&
        !focusCompiledConcept?.engineConceptId
      ) {
        throw new BadRequestException(
          "Full coach activation requires at least one engine-compatible concept",
        );
      }

      const updatedCompiledCoachPack = await tx.compiledCoachPack.update({
        where: {
          id: compiledCoachPack.id,
        },
        data: {
          compilationStatus: CompiledCoachPackStatus.compiled,
          focusCompiledConceptId: focusCompiledConcept?.id ?? null,
          focusEngineConceptId: focusCompiledConcept?.engineConceptId ?? null,
        },
        include: {
          concepts: true,
        },
      });

      for (const compiledConcept of updatedCompiledCoachPack.concepts) {
        await tx.learnerCompiledCoachConceptState.upsert({
          where: {
            learnerId_coursePackId_compiledCoachConceptId: {
              learnerId: input.learnerId,
              coursePackId: coursePack.id,
              compiledCoachConceptId: compiledConcept.id,
            },
          },
          update: {},
          create: {
            learnerId: input.learnerId,
            coursePackId: coursePack.id,
            compiledCoachConceptId: compiledConcept.id,
          },
        });
      }

      const activeCourseContext = await tx.activeCourseContext.upsert({
        where: {
          learnerId: input.learnerId,
        },
        update: {
          coursePackId: coursePack.id,
          compiledCoachPackId: updatedCompiledCoachPack.id,
          confirmationSnapshotId: confirmationSnapshot.id,
          supportLevel: confirmationSnapshot.supportLevelCandidate,
          courseTitle: coursePack.courseTitle,
          focusCompiledConceptId: focusCompiledConcept?.id ?? null,
          focusEngineConceptId: focusCompiledConcept?.engineConceptId ?? null,
          refreshFollowThroughConceptId: null,
          refreshResolvedConceptId: null,
          recurringResolvedConceptId: null,
          recurringResolvedAt: null,
          activatedAt: activationTime,
        },
        create: {
          learnerId: input.learnerId,
          coursePackId: coursePack.id,
          compiledCoachPackId: updatedCompiledCoachPack.id,
          confirmationSnapshotId: confirmationSnapshot.id,
          supportLevel: confirmationSnapshot.supportLevelCandidate,
          courseTitle: coursePack.courseTitle,
          focusCompiledConceptId: focusCompiledConcept?.id ?? null,
          focusEngineConceptId: focusCompiledConcept?.engineConceptId ?? null,
          refreshFollowThroughConceptId: null,
          refreshResolvedConceptId: null,
          recurringResolvedConceptId: null,
          recurringResolvedAt: null,
          activatedAt: activationTime,
        },
      });

      await tx.confirmationSnapshot.update({
        where: {
          id: confirmationSnapshot.id,
        },
        data: {
          status: "activated",
          activatedAt: activationTime,
        },
      });

      const updatedCoursePack = await tx.coursePack.update({
        where: {
          id: coursePack.id,
        },
        data: {
          isActive: true,
          lifecycleState: "active",
          readinessState: "activation_ready",
          supportLevelFinal: confirmationSnapshot.supportLevelCandidate,
          activeConfirmationSnapshotId: confirmationSnapshot.id,
          archivedAt: null,
          confirmedAt: coursePack.confirmedAt ?? activationTime,
          activatedAt: activationTime,
          confirmedUnitCount: confirmationSnapshot.units.length,
          confirmedConceptCount: confirmationSnapshot.concepts.length,
          driftStatus: "clean",
          driftReasonCodes: [],
          requiresReconfirmation: false,
          activeContextState: "current",
        },
      });

      return {
        compiledCoachPack: updatedCompiledCoachPack,
        activeCourseContext: await tx.activeCourseContext.findUniqueOrThrow({
          where: {
            learnerId: input.learnerId,
          },
          include: {
            compiledCoachPack: {
              include: {
                concepts: true,
              },
            },
            focusCompiledConcept: true,
            coursePack: true,
          },
        }),
        coursePack: updatedCoursePack,
      };
    });

    return mapCoursePackActivationResponse({
      coursePack: activationResult.coursePack,
      confirmationSnapshot: {
        ...confirmationSnapshot,
        status: "activated",
        activatedAt: activationTime,
      },
      compiledCoachPack: activationResult.compiledCoachPack,
      activeCourseContext: activationResult.activeCourseContext,
    });
  }

  private assertActivationEligibility(
    coursePack: {
      driftStatus: string;
      requiresReconfirmation: boolean;
      activeConfirmationSnapshotId: string | null;
    },
    confirmationSnapshot: ConfirmationSnapshotWithRelations,
  ) {
    if (coursePack.driftStatus === "pending_refresh") {
      throw new BadRequestException(
        "Course pack materials changed and need a fresh extraction before activation",
      );
    }

    if (coursePack.requiresReconfirmation) {
      throw new BadRequestException(
        "Course pack changes require a fresh review before activation",
      );
    }

    if (
      coursePack.activeConfirmationSnapshotId &&
      confirmationSnapshot.id !== coursePack.activeConfirmationSnapshotId
    ) {
      throw new BadRequestException(
        "Only the latest confirmed course review can be activated",
      );
    }

    if (confirmationSnapshot.status === "superseded") {
      throw new BadRequestException(
        "Superseded confirmation snapshots cannot be activated",
      );
    }

    if (
      confirmationSnapshot.supportLevelCandidate ===
      CoursePackSupportLevel.not_ready
    ) {
      throw new BadRequestException(
        "Course pack support level is not ready for activation",
      );
    }

    if (
      confirmationSnapshot.lowConfidenceIncludedCount > 0 &&
      confirmationSnapshot.lowConfidenceAcknowledged !== true
    ) {
      throw new BadRequestException(
        "Low-confidence confirmation requires acknowledgment before activation",
      );
    }

    if (confirmationSnapshot.concepts.length === 0) {
      throw new BadRequestException(
        "No confirmed concepts available for activation",
      );
    }
  }

  private async loadConfirmationSnapshot(input: {
    coursePackId: string;
    confirmationSnapshotId?: string;
  }) {
    const confirmationSnapshot =
      input.confirmationSnapshotId != null
        ? await this.prisma.confirmationSnapshot.findFirst({
            where: {
              id: input.confirmationSnapshotId,
              coursePackId: input.coursePackId,
            },
            include: COURSE_PACK_CONFIRMATION_INCLUDE,
          })
        : await this.prisma.confirmationSnapshot.findFirst({
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

    return confirmationSnapshot;
  }

  private async createCompiledCoachPack(
    tx: Prisma.TransactionClient,
    input: {
      learnerId: string;
      coursePackId: string;
      confirmationSnapshot: ConfirmationSnapshotWithRelations;
    },
  ) {
    const compiledCoachPack = await tx.compiledCoachPack.create({
      data: {
        coursePackId: input.coursePackId,
        learnerId: input.learnerId,
        confirmationSnapshotId: input.confirmationSnapshot.id,
        supportLevel: input.confirmationSnapshot.supportLevelCandidate,
      },
    });
    const compiledConceptDrafts = buildCompiledConceptDrafts(
      input.confirmationSnapshot,
    );

    for (const concept of compiledConceptDrafts) {
      await tx.compiledCoachConcept.create({
        data: {
          compiledCoachPackId: compiledCoachPack.id,
          sourceConfirmedConceptId: concept.sourceConfirmedConceptId,
          displayLabel: concept.displayLabel,
          normalizedLabel: concept.normalizedLabel,
          sequenceOrder: concept.sequenceOrder,
          coachabilityStatus: concept.coachabilityStatus,
          canonicalTemplateId: concept.canonicalTemplateId,
          engineConceptId: concept.engineConceptId,
          priorityTier: concept.priorityTier,
          suggestedTimeSharePct: concept.suggestedTimeSharePct,
          isExamImportant: concept.isExamImportant,
          sourceEvidenceIds: concept.sourceEvidenceIds,
        },
      });
    }

    return tx.compiledCoachPack.findUniqueOrThrow({
      where: {
        id: compiledCoachPack.id,
      },
      include: {
        concepts: true,
      },
    });
  }

  private async reuseCompiledCoachPack(
    tx: Prisma.TransactionClient,
    compiledCoachPackId: string,
  ) {
    await tx.compiledCoachPack.update({
      where: {
        id: compiledCoachPackId,
      },
      data: {
        compilationStatus: CompiledCoachPackStatus.compiled,
      },
    });

    return tx.compiledCoachPack.findUniqueOrThrow({
      where: {
        id: compiledCoachPackId,
      },
      include: {
        concepts: true,
      },
    });
  }
}

function buildCompiledConceptDrafts(
  confirmationSnapshot: ConfirmationSnapshotWithRelations,
) {
  const blueprintAreas = confirmationSnapshot.extractionSnapshot.examBlueprint?.areas ?? [];

  return confirmationSnapshot.concepts
    .slice()
    .sort((left, right) => left.sequenceOrder - right.sequenceOrder)
    .map(
      (concept): CompiledConceptDraft => ({
        sourceConfirmedConceptId: concept.id,
        displayLabel: concept.label,
        normalizedLabel: concept.normalizedLabel,
        sequenceOrder: concept.sequenceOrder,
        coachabilityStatus: concept.coachabilityStatus,
        canonicalTemplateId: concept.canonicalTemplateId,
        engineConceptId: concept.engineConceptId,
        priorityTier: resolvePriorityTier(
          concept.referencedBlueprintAreaIds,
          blueprintAreas,
        ),
        suggestedTimeSharePct: resolveTimeShare(
          concept.referencedBlueprintAreaIds,
          blueprintAreas,
        ),
        isExamImportant: concept.isExamImportant,
        sourceEvidenceIds: concept.sourceEvidenceIds,
      }),
    );
}

function resolvePriorityTier(
  referencedBlueprintAreaIds: string[],
  blueprintAreas: Array<{
    id: string;
    priorityTier: ExamBlueprintPriorityTier;
  }>,
) {
  const tiers = blueprintAreas
    .filter((area) => referencedBlueprintAreaIds.includes(area.id))
    .map((area) => area.priorityTier);

  if (tiers.includes(ExamBlueprintPriorityTier.high)) {
    return ExamBlueprintPriorityTier.high;
  }

  if (tiers.includes(ExamBlueprintPriorityTier.medium)) {
    return ExamBlueprintPriorityTier.medium;
  }

  return ExamBlueprintPriorityTier.low;
}

function resolveTimeShare(
  referencedBlueprintAreaIds: string[],
  blueprintAreas: Array<{
    id: string;
    suggestedTimeSharePct: number;
  }>,
) {
  const matchingAreas = blueprintAreas.filter((area) =>
    referencedBlueprintAreaIds.includes(area.id),
  );

  if (matchingAreas.length === 0) {
    return 0;
  }

  return Math.max(...matchingAreas.map((area) => area.suggestedTimeSharePct));
}

function resolveInactiveLifecycleState(coursePack: {
  driftStatus: string;
  readinessState: string;
}): CoursePackLifecycleState {
  if (coursePack.driftStatus === "review_required") {
    return CoursePackLifecycleState.awaiting_confirmation;
  }

  if (coursePack.readinessState === "review_ready") {
    return CoursePackLifecycleState.awaiting_confirmation;
  }

  if (
    [
      "awaiting_documents",
      "awaiting_roles",
      "awaiting_extraction",
      "blocked",
    ].includes(coursePack.readinessState)
  ) {
    return CoursePackLifecycleState.classifying;
  }

  return CoursePackLifecycleState.confirmed;
}

function resolveInactiveReadinessState(coursePack: {
  requiresReconfirmation?: boolean;
  driftStatus: string;
  readinessState: string;
}): CoursePackReadinessState {
  if (coursePack.requiresReconfirmation || coursePack.driftStatus === "review_required") {
    return CoursePackReadinessState.review_ready;
  }

  return coursePack.readinessState === "activation_ready"
    ? CoursePackReadinessState.activation_ready
    : (coursePack.readinessState as CoursePackReadinessState);
}
