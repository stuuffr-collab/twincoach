import { Injectable } from "@nestjs/common";
import {
  CoursePackSupportLevel,
  SessionStatus,
  SessionType,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { mapActiveCourseContextResponse } from "./course-pack.mapper";
import {
  ActiveCourseContextPayload,
  PackProgressMemoryPayload,
  RecurringFocusDecisionPayload,
  ResolvedRecurringFocusPayload,
} from "./course-pack.types";
import {
  ACTIVE_COURSE_CONTEXT_INCLUDE,
  ActiveCourseContextWithRelations,
  COURSE_PACK_CONFIRMATION_INCLUDE,
} from "./course-pack.query";
import { deriveCoursePackRefreshContext } from "./course-pack-refresh-handoff";
import { derivePackProgressMemory } from "./course-pack-progress-memory";
import { deriveRecurringFocusDecision } from "./course-pack-recurring-focus";

@Injectable()
export class CoursePackContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveContext(learnerId: string) {
    return this.prisma.activeCourseContext.findUnique({
      where: {
        learnerId,
      },
      include: ACTIVE_COURSE_CONTEXT_INCLUDE,
    });
  }

  async getActiveContextPayload(learnerId: string) {
    const activeContext = await this.getActiveContext(learnerId);

    if (!activeContext) {
      return null;
    }

    const refreshContext = await this.buildRefreshContext(activeContext);
    const followThrough = this.buildFollowThrough({
      activeContext,
      refreshContext,
    });
    const resolution = this.buildResolution({
      activeContext,
      refreshContext,
    });

    return mapActiveCourseContextResponse({
      ...activeContext,
      refreshContext,
      followThrough,
      resolution,
    });
  }

  async getEngineCompatiblePlanningContext(learnerId: string) {
    const activeContext = await this.getActiveContext(learnerId);

    if (
      !activeContext ||
      activeContext.supportLevel !== CoursePackSupportLevel.full_coach ||
      !activeContext.focusEngineConceptId
    ) {
      return null;
    }

    const conceptStates = await this.prisma.learnerCompiledCoachConceptState.findMany({
      where: {
        learnerId,
        coursePackId: activeContext.coursePackId,
        compiledCoachConceptId: {
          in: activeContext.compiledCoachPack.concepts.map((concept) => concept.id),
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return {
      ...activeContext,
      conceptStates,
      focusCompiledConcept:
        activeContext.compiledCoachPack.concepts.find(
          (concept) => concept.id === activeContext.focusCompiledConceptId,
        ) ?? null,
    };
  }

  async getPackProgressMemory(input: {
    learnerId: string;
    currentFocusConceptId: string | null;
    currentFocusCompiledConceptId: string | null;
    currentFocusConceptLabel: string | null;
  }): Promise<PackProgressMemoryPayload | null> {
    const activeContext = await this.getActiveContext(input.learnerId);

    if (!activeContext) {
      return null;
    }

    const compiledConceptByEngineId = new Map(
      activeContext.compiledCoachPack.concepts
        .filter(
          (concept): concept is typeof concept & { engineConceptId: string } =>
            Boolean(concept.engineConceptId),
        )
        .map((concept) => [concept.engineConceptId, concept]),
    );

    const resolvedCurrentFocus =
      input.currentFocusCompiledConceptId != null
        ? activeContext.compiledCoachPack.concepts.find(
            (concept) => concept.id === input.currentFocusCompiledConceptId,
          ) ?? null
        : input.currentFocusConceptId != null
          ? compiledConceptByEngineId.get(input.currentFocusConceptId) ?? null
          : null;

    const recentSessions = await this.prisma.session.findMany({
      where: {
        learnerId: input.learnerId,
        sessionType: SessionType.daily_practice,
        status: SessionStatus.completed,
        activeCoursePackId: activeContext.coursePackId,
      },
      include: {
        focusCompiledConcept: true,
        focusConcept: true,
      },
      orderBy: [
        {
          completedAt: "desc",
        },
        {
          generatedAt: "desc",
        },
      ],
      take: 6,
    });

    const recentlyStabilized =
      activeContext.refreshResolvedConceptId != null
        ? activeContext.compiledCoachPack.concepts.find(
            (concept) => concept.id === activeContext.refreshResolvedConceptId,
          ) ?? null
        : this.resolveRecentlyStabilizedFromSessions({
            activeContext,
            recentSessions,
            compiledConceptByEngineId,
          });

    const currentFocusState =
      resolvedCurrentFocus?.id != null
        ? await this.prisma.learnerCompiledCoachConceptState.findUnique({
            where: {
              learnerId_coursePackId_compiledCoachConceptId: {
                learnerId: input.learnerId,
                coursePackId: activeContext.coursePackId,
                compiledCoachConceptId: resolvedCurrentFocus.id,
              },
            },
          })
        : null;

    return derivePackProgressMemory({
      currentFocus:
        input.currentFocusConceptLabel != null
          ? {
              normalizedConceptId: resolvedCurrentFocus?.id ?? null,
              label:
                resolvedCurrentFocus?.displayLabel ??
                input.currentFocusConceptLabel,
            }
          : null,
      recentFocuses: recentSessions
        .map((session) =>
          this.resolveSessionFocus({
            activeContext,
            session,
            compiledConceptByEngineId,
          }),
        )
        .filter((focus): focus is NonNullable<typeof focus> => Boolean(focus)),
      recentlyStabilized: recentlyStabilized
        ? {
            normalizedConceptId: recentlyStabilized.id,
            label: recentlyStabilized.displayLabel,
            observedAt: recentlyStabilized.updatedAt,
          }
        : null,
      currentFocusState:
        currentFocusState == null
          ? null
          : {
              masteryState: currentFocusState.masteryState,
              recentErrorTag: currentFocusState.recentErrorTag,
            },
    });
  }

  async getRecurringFocusDecision(input: {
    learnerId: string;
    currentFocusConceptId: string | null;
    currentFocusCompiledConceptId: string | null;
    currentFocusConceptLabel: string | null;
    packProgressMemory?: PackProgressMemoryPayload | null;
  }): Promise<RecurringFocusDecisionPayload | null> {
    const activeContext = await this.getActiveContext(input.learnerId);
    const packProgressMemory =
      input.packProgressMemory ??
      (await this.getPackProgressMemory({
        learnerId: input.learnerId,
        currentFocusConceptId: input.currentFocusConceptId,
        currentFocusCompiledConceptId: input.currentFocusCompiledConceptId,
        currentFocusConceptLabel: input.currentFocusConceptLabel,
      }));

    return deriveRecurringFocusDecision(
      packProgressMemory,
      this.buildResolvedRecurringMemory(activeContext),
    );
  }

  async resolveCompiledConceptForAttempt(input: {
    learnerId: string;
    coursePackId: string | null;
    focusCompiledConceptId: string | null;
    engineConceptId: string;
  }) {
    if (!input.coursePackId) {
      return null;
    }

    const activeContext = await this.getActiveContext(input.learnerId);

    if (!activeContext || activeContext.coursePackId !== input.coursePackId) {
      return null;
    }

    const focusCompiledConcept =
      input.focusCompiledConceptId != null
        ? activeContext.compiledCoachPack.concepts.find(
            (concept) =>
              concept.id === input.focusCompiledConceptId &&
              concept.engineConceptId === input.engineConceptId,
          ) ?? null
        : null;

    if (focusCompiledConcept) {
      return focusCompiledConcept;
    }

    return (
      activeContext.compiledCoachPack.concepts.find(
        (concept) => concept.engineConceptId === input.engineConceptId,
      ) ?? null
    );
  }

  private async buildRefreshContext(activeContext: ActiveCourseContextWithRelations) {
    const currentConfirmationSnapshot =
      await this.prisma.confirmationSnapshot.findUnique({
        where: {
          id: activeContext.confirmationSnapshotId,
        },
        include: COURSE_PACK_CONFIRMATION_INCLUDE,
      });

    if (!currentConfirmationSnapshot) {
      return null;
    }

    const previousConfirmationSnapshot =
      await this.prisma.confirmationSnapshot.findFirst({
        where: {
          coursePackId: activeContext.coursePackId,
          createdAt: {
            lt: currentConfirmationSnapshot.createdAt,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: COURSE_PACK_CONFIRMATION_INCLUDE,
      });

    const refreshContext = deriveCoursePackRefreshContext({
      currentConfirmationSnapshot,
      previousConfirmationSnapshot,
      focusCompiledConcept: activeContext.focusCompiledConcept
        ? {
            sourceConfirmedConceptId:
              activeContext.focusCompiledConcept.sourceConfirmedConceptId,
            displayLabel: activeContext.focusCompiledConcept.displayLabel,
          }
        : null,
    });

    if (!refreshContext) {
      return null;
    }

    const firstSessionCount = await this.prisma.session.count({
      where: {
        learnerId: activeContext.learnerId,
        sessionType: SessionType.daily_practice,
        activeCoursePackId: activeContext.coursePackId,
        generatedAt: {
          gte: activeContext.activatedAt,
        },
      },
    });

    return {
      ...refreshContext,
      firstSessionPending: firstSessionCount === 0,
    };
  }

  private buildFollowThrough(input: {
    activeContext: ActiveCourseContextWithRelations;
    refreshContext: ActiveCourseContextPayload["refreshContext"];
  }) {
    if (
      !input.refreshContext ||
      !input.activeContext.refreshFollowThroughConceptId
    ) {
      return null;
    }

    const targetConcept =
      input.activeContext.compiledCoachPack.concepts.find(
        (concept) => concept.id === input.activeContext.refreshFollowThroughConceptId,
      ) ?? null;

    if (!targetConcept) {
      return null;
    }

    return {
      targetNormalizedConceptId: targetConcept.id,
      targetLabel: targetConcept.displayLabel,
      reasonType: input.refreshContext.reasonType,
    } satisfies NonNullable<ActiveCourseContextPayload["followThrough"]>;
  }

  private buildResolution(input: {
    activeContext: ActiveCourseContextWithRelations;
    refreshContext: ActiveCourseContextPayload["refreshContext"];
  }) {
    if (
      !input.refreshContext ||
      !input.activeContext.refreshResolvedConceptId
    ) {
      return null;
    }

    const resolvedConcept =
      input.activeContext.compiledCoachPack.concepts.find(
        (concept) => concept.id === input.activeContext.refreshResolvedConceptId,
      ) ?? null;

    if (!resolvedConcept) {
      return null;
    }

    return {
      resolvedNormalizedConceptId: resolvedConcept.id,
      resolvedLabel: resolvedConcept.displayLabel,
      reasonType: input.refreshContext.reasonType,
    } satisfies NonNullable<ActiveCourseContextPayload["resolution"]>;
  }

  private resolveSessionFocus(input: {
    activeContext: ActiveCourseContextWithRelations;
    session: {
      focusCompiledConceptId: string | null;
      focusConceptId: string | null;
      refreshSequence: number | null;
      completedAt: Date | null;
      generatedAt: Date;
      focusCompiledConcept: {
        displayLabel: string;
      } | null;
      focusConcept: {
        learnerLabel: string;
      } | null;
    };
    compiledConceptByEngineId: Map<
      string,
      ActiveCourseContextWithRelations["compiledCoachPack"]["concepts"][number]
    >;
  }) {
    const observedAt =
      input.session.completedAt ?? input.session.generatedAt ?? new Date();

    if (input.session.focusCompiledConceptId && input.session.focusCompiledConcept) {
      return {
        normalizedConceptId: input.session.focusCompiledConceptId,
        label: input.session.focusCompiledConcept.displayLabel,
        observedAt,
        refreshSequence: input.session.refreshSequence,
      };
    }

    if (input.session.focusConceptId) {
      const mappedConcept = input.compiledConceptByEngineId.get(
        input.session.focusConceptId,
      );

      if (mappedConcept) {
        return {
          normalizedConceptId: mappedConcept.id,
          label: mappedConcept.displayLabel,
          observedAt,
          refreshSequence: input.session.refreshSequence,
        };
      }
    }

    if (input.session.focusConcept) {
      return {
        normalizedConceptId: null,
        label: input.session.focusConcept.learnerLabel,
        observedAt,
        refreshSequence: input.session.refreshSequence,
      };
    }

    return null;
  }

  private resolveRecentlyStabilizedFromSessions(input: {
    activeContext: ActiveCourseContextWithRelations;
    recentSessions: Array<{
      focusCompiledConceptId: string | null;
      focusConceptId: string | null;
      refreshSequence: number | null;
      completedAt: Date | null;
      generatedAt: Date;
      focusCompiledConcept: {
        displayLabel: string;
      } | null;
      focusConcept: {
        learnerLabel: string;
      } | null;
    }>;
    compiledConceptByEngineId: Map<
      string,
      ActiveCourseContextWithRelations["compiledCoachPack"]["concepts"][number]
    >;
  }) {
    const refreshSession = input.recentSessions.find(
      (session) => session.refreshSequence === 1 || session.refreshSequence === 2,
    );

    if (!refreshSession) {
      return null;
    }

    if (refreshSession.focusCompiledConceptId) {
      return (
        input.activeContext.compiledCoachPack.concepts.find(
          (concept) => concept.id === refreshSession.focusCompiledConceptId,
        ) ?? null
      );
    }

    if (refreshSession.focusConceptId) {
      return input.compiledConceptByEngineId.get(refreshSession.focusConceptId) ?? null;
    }

    return null;
  }

  private buildResolvedRecurringMemory(
    activeContext: ActiveCourseContextWithRelations | null,
  ): ResolvedRecurringFocusPayload | null {
    if (
      !activeContext?.recurringResolvedConceptId ||
      !activeContext.recurringResolvedAt
    ) {
      return null;
    }

    const resolvedConcept =
      activeContext.compiledCoachPack.concepts.find(
        (concept) => concept.id === activeContext.recurringResolvedConceptId,
      ) ?? null;

    if (!resolvedConcept) {
      return null;
    }

    return {
      normalizedConceptId: resolvedConcept.id,
      label: resolvedConcept.displayLabel,
      resolvedAt: activeContext.recurringResolvedAt.toISOString(),
    };
  }
}
