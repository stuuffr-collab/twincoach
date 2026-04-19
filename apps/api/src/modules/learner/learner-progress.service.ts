import {
  HelpKind,
  MasteryState,
  MomentumState,
  Prisma,
  ProgrammingErrorTag,
  ResilienceState,
  SessionMode,
  StabilityState,
} from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { CoursePackContextService } from "../course-pack/course-pack-context.service";
import { PrismaService } from "../../prisma/prisma.service";

type PersonaClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class LearnerProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly coursePackContextService: CoursePackContextService,
  ) {}

  async ensureProgrammingPersona(
    learnerId: string,
    client: PersonaClient = this.prisma,
  ) {
    const profile = await client.programmingProfile.findUnique({
      where: { learnerId },
    });

    if (!profile) {
      return null;
    }

    return client.learnerProgrammingPersona.upsert({
      where: { learnerId },
      update: {
        preferredHelpStyle: profile.preferredHelpStyle,
      },
      create: {
        learnerId,
        modelVersion: "programming_persona_v1",
        preferredHelpStyle: profile.preferredHelpStyle,
      },
    });
  }

  async getPersonaSnapshot(learnerId: string) {
    await this.ensureProgrammingPersona(learnerId);

    const [persona, conceptStates] = await Promise.all([
      this.prisma.learnerProgrammingPersona.findUnique({
        where: { learnerId },
        include: {
          focusConcept: true,
        },
      }),
      this.prisma.learnerProgrammingConceptState.findMany({
        where: { learnerId },
        include: {
          concept: true,
        },
        orderBy: {
          concept: {
            sequenceOrder: "asc",
          },
        },
      }),
    ]);

    return {
      persona,
      conceptStates,
    };
  }

  async markSessionResumed(learnerId: string) {
    await this.ensureProgrammingPersona(learnerId);

    await this.prisma.learnerProgrammingPersona.update({
      where: { learnerId },
      data: {
        sessionMomentumState: MomentumState.low,
      },
    });
  }

  async markSessionStarted(learnerId: string) {
    await this.ensureProgrammingPersona(learnerId);

    await this.prisma.learnerProgrammingPersona.update({
      where: { learnerId },
      data: {
        sessionMomentumState: MomentumState.steady,
      },
    });
  }

  async markSessionCompleted(
    tx: Prisma.TransactionClient,
    input: {
      learnerId: string;
      completedWithRecovery: boolean;
    },
  ) {
    await this.ensureProgrammingPersona(input.learnerId, tx);

    await tx.learnerProgrammingPersona.update({
      where: { learnerId: input.learnerId },
      data: {
        sessionMomentumState: input.completedWithRecovery
          ? MomentumState.strong
          : MomentumState.steady,
      },
    });
  }

  async recordProgrammingAttemptOutcome(
    tx: Prisma.TransactionClient,
    input: {
      learnerId: string;
      sessionId: string;
      conceptId: string;
      taskType: string;
      supportedErrorTags: Prisma.JsonValue;
      isCorrect: boolean;
      primaryErrorTag: ProgrammingErrorTag | null;
      sessionMode: SessionMode | null;
      activeCoursePackId?: string | null;
      focusCompiledConceptId?: string | null;
    },
  ) {
    const persona = await this.ensureProgrammingPersona(input.learnerId, tx);

    if (!persona) {
      return;
    }

    const existingConceptState =
      await tx.learnerProgrammingConceptState.findUnique({
        where: {
          learnerId_conceptId: {
            learnerId: input.learnerId,
            conceptId: input.conceptId,
          },
        },
      });

    const priorIncorrectInSession = input.sessionMode
      ? await tx.attempt.findFirst({
          where: {
            learnerId: input.learnerId,
            sessionId: input.sessionId,
            isCorrect: false,
          },
          orderBy: {
            createdAt: "desc",
          },
        })
      : null;

    await tx.learnerProgrammingConceptState.upsert({
      where: {
        learnerId_conceptId: {
          learnerId: input.learnerId,
          conceptId: input.conceptId,
        },
      },
      update: {
        masteryState: this.getNextMasteryState(
          existingConceptState?.masteryState ?? MasteryState.unknown,
          input.isCorrect,
        ),
        recentErrorTag: input.isCorrect ? null : input.primaryErrorTag,
        lastObservedAt: new Date(),
      },
      create: {
        learnerId: input.learnerId,
        conceptId: input.conceptId,
        masteryState: this.getNextMasteryState(
          MasteryState.unknown,
          input.isCorrect,
        ),
        recentErrorTag: input.isCorrect ? null : input.primaryErrorTag,
        lastObservedAt: new Date(),
      },
    });

    await tx.learnerProgrammingPersona.update({
      where: { learnerId: input.learnerId },
      data: {
        syntaxStabilityState: this.getNextSyntaxState(
          persona.syntaxStabilityState,
          input,
        ),
        logicTracingState: this.getNextLogicTracingState(
          persona.logicTracingState,
          input,
        ),
        debuggingResilienceState: this.getNextDebuggingResilienceState(
          persona.debuggingResilienceState,
          input,
          Boolean(priorIncorrectInSession),
        ),
        sessionMomentumState: input.isCorrect
          ? MomentumState.steady
          : persona.sessionMomentumState === MomentumState.unknown
            ? MomentumState.steady
            : persona.sessionMomentumState,
        focusConceptId: input.conceptId,
      },
    });

    const resolvedCompiledConcept =
      await this.coursePackContextService.resolveCompiledConceptForAttempt({
        learnerId: input.learnerId,
        coursePackId: input.activeCoursePackId ?? null,
        focusCompiledConceptId: input.focusCompiledConceptId ?? null,
        engineConceptId: input.conceptId,
      });

    if (!resolvedCompiledConcept) {
      return;
    }

    const existingCompiledConceptState =
      await tx.learnerCompiledCoachConceptState.findUnique({
        where: {
          learnerId_coursePackId_compiledCoachConceptId: {
            learnerId: input.learnerId,
            coursePackId: input.activeCoursePackId!,
            compiledCoachConceptId: resolvedCompiledConcept.id,
          },
        },
      });

    await tx.learnerCompiledCoachConceptState.upsert({
      where: {
        learnerId_coursePackId_compiledCoachConceptId: {
          learnerId: input.learnerId,
          coursePackId: input.activeCoursePackId!,
          compiledCoachConceptId: resolvedCompiledConcept.id,
        },
      },
      update: {
        masteryState: this.getNextMasteryState(
          existingCompiledConceptState?.masteryState ?? MasteryState.unknown,
          input.isCorrect,
        ),
        recentErrorTag: input.isCorrect ? null : input.primaryErrorTag,
        lastObservedAt: new Date(),
      },
      create: {
        learnerId: input.learnerId,
        coursePackId: input.activeCoursePackId!,
        compiledCoachConceptId: resolvedCompiledConcept.id,
        masteryState: this.getNextMasteryState(
          MasteryState.unknown,
          input.isCorrect,
        ),
        recentErrorTag: input.isCorrect ? null : input.primaryErrorTag,
        lastObservedAt: new Date(),
      },
    });
  }

  async getReadinessSummary(learnerId: string) {
    const snapshot = await this.getPersonaSnapshot(learnerId);

    if (!snapshot.persona) {
      return {
        readinessBand: "No Programming Profile",
        explanation:
          "Programming onboarding is not complete yet, so no study state is available.",
        nextStep: "Complete onboarding to build your first programming study state.",
      };
    }

    if (snapshot.persona.sessionMomentumState === MomentumState.low) {
      return {
        readinessBand: "Recovery Needed",
        explanation:
          "Recent work suggests the learner needs a shorter recovery step before pushing harder.",
        nextStep: "Use a shorter session to rebuild momentum before adding difficulty.",
      };
    }

    if (
      snapshot.persona.debuggingResilienceState === ResilienceState.fragile
    ) {
      return {
        readinessBand: "Debugging Focus",
        explanation:
          "Recent work suggests debugging structure needs support before broader practice.",
        nextStep: "Prioritize one debugging-focused session mode next.",
      };
    }

    const hasEmergingConcept = snapshot.conceptStates.some(
      (state) => state.masteryState === MasteryState.emerging,
    );

    if (hasEmergingConcept) {
      return {
        readinessBand: "Building Foundations",
        explanation:
          "Recent work suggests at least one concept still needs a steadier pass.",
        nextStep: "Focus the next session on one concept that still needs support.",
      };
    }

    return {
      readinessBand: "Steady Progress",
      explanation:
        "Recent work suggests the learner is ready for a steady practice session.",
      nextStep: "Continue with steady daily practice on current Python foundations.",
    };
  }

  private getNextMasteryState(current: MasteryState, isCorrect: boolean) {
    if (!isCorrect) {
      return MasteryState.emerging;
    }

    if (current === MasteryState.unknown) {
      return MasteryState.emerging;
    }

    return MasteryState.steady;
  }

  private getNextSyntaxState(
    current: StabilityState,
    input: {
      isCorrect: boolean;
      primaryErrorTag: ProgrammingErrorTag | null;
      supportedErrorTags: Prisma.JsonValue;
    },
  ) {
    const hasSyntaxContext =
      input.primaryErrorTag === ProgrammingErrorTag.syntax_form_error ||
      this.readStringArray(input.supportedErrorTags).includes(
        ProgrammingErrorTag.syntax_form_error,
      );

    if (!hasSyntaxContext) {
      return current;
    }

    if (!input.isCorrect) {
      return StabilityState.fragile;
    }

    if (current === StabilityState.fragile || current === StabilityState.unknown) {
      return StabilityState.developing;
    }

    return StabilityState.steady;
  }

  private getNextLogicTracingState(
    current: StabilityState,
    input: {
      isCorrect: boolean;
      primaryErrorTag: ProgrammingErrorTag | null;
      taskType: string;
    },
  ) {
    const hasLogicContext =
      input.taskType === "trace_reasoning" ||
      input.taskType === "output_prediction" ||
      input.primaryErrorTag === ProgrammingErrorTag.value_tracking_error ||
      input.primaryErrorTag === ProgrammingErrorTag.branch_logic_error ||
      input.primaryErrorTag === ProgrammingErrorTag.loop_control_error;

    if (!hasLogicContext) {
      return current;
    }

    if (!input.isCorrect) {
      return StabilityState.fragile;
    }

    if (current === StabilityState.fragile || current === StabilityState.unknown) {
      return StabilityState.developing;
    }

    return StabilityState.steady;
  }

  private getNextDebuggingResilienceState(
    current: ResilienceState,
    input: {
      isCorrect: boolean;
      primaryErrorTag: ProgrammingErrorTag | null;
      taskType: string;
      sessionMode: SessionMode | null;
    },
    hadPriorIncorrect: boolean,
  ) {
    const hasDebugContext =
      input.taskType === "bug_spotting" ||
      input.sessionMode === SessionMode.debugging_drill ||
      input.primaryErrorTag === ProgrammingErrorTag.debugging_strategy_error;

    if (!hasDebugContext) {
      return current;
    }

    if (!input.isCorrect) {
      return ResilienceState.fragile;
    }

    if (hadPriorIncorrect) {
      return current === ResilienceState.recovering
        ? ResilienceState.steady
        : ResilienceState.recovering;
    }

    if (current === ResilienceState.fragile) {
      return ResilienceState.recovering;
    }

    return current === ResilienceState.unknown
      ? ResilienceState.recovering
      : ResilienceState.steady;
  }

  private readStringArray(input: Prisma.JsonValue) {
    if (!Array.isArray(input)) {
      return [];
    }

    return input.filter((value): value is string => typeof value === "string");
  }
}
