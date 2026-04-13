import {
  MasteryState,
  MomentumState,
  Prisma,
  ProgrammingErrorTag,
  ResilienceState,
  SessionMode,
} from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { CurriculumService } from "../curriculum/curriculum.service";
import { PrismaService } from "../../prisma/prisma.service";
import { LearnerProgressService } from "./learner-progress.service";

type PlannerDecision = {
  programmingStateCode:
    | "building_foundations"
    | "debugging_focus"
    | "steady_progress"
    | "recovery_needed";
  programmingStateLabel: string;
  focusConceptId: string;
  focusConceptLabel: string;
  sessionMode: SessionMode;
  sessionModeLabel: string;
  rationaleCode:
    | "recent_concept_errors"
    | "repeated_debugging_errors"
    | "strong_recent_progress"
    | "recent_dropoff";
  rationaleText: string;
  nextStepText: string;
};

@Injectable()
export class ProgrammingPlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly curriculumService: CurriculumService,
    private readonly learnerProgressService: LearnerProgressService,
  ) {}

  async getProgrammingState(learnerId: string) {
    const snapshot =
      await this.learnerProgressService.getPersonaSnapshot(learnerId);
    const concepts = await this.curriculumService.getProgrammingConcepts();
    const recentIncorrectAttempts = await this.prisma.attempt.findMany({
      where: {
        learnerId,
        isCorrect: false,
        primaryErrorTag: {
          not: null,
        },
      },
      include: {
        questionItem: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 4,
    });

    const focusConcept =
      this.selectFocusConcept({
        concepts,
        snapshot,
        recentIncorrectAttempts,
      }) ?? concepts[0];

    const debuggingMissCount = recentIncorrectAttempts.filter((attempt) => {
      return (
        attempt.primaryErrorTag === ProgrammingErrorTag.debugging_strategy_error
      );
    }).length;

    let sessionMode: SessionMode = SessionMode.steady_practice;
    let rationaleCode: PlannerDecision["rationaleCode"] =
      "strong_recent_progress";

    if (snapshot.persona?.sessionMomentumState === MomentumState.low) {
      sessionMode = SessionMode.recovery_mode;
      rationaleCode = "recent_dropoff";
    } else if (
      snapshot.persona?.debuggingResilienceState === ResilienceState.fragile &&
      debuggingMissCount >= 2
    ) {
      sessionMode = SessionMode.debugging_drill;
      rationaleCode = "repeated_debugging_errors";
    } else {
      const focusConceptState = snapshot.conceptStates.find(
        (state) => state.conceptId === focusConcept.id,
      );

      if (focusConceptState?.masteryState === MasteryState.emerging) {
        sessionMode = SessionMode.concept_repair;
        rationaleCode = "recent_concept_errors";
      }
    }

    const decision = this.buildDecision({
      focusConceptId: focusConcept.id,
      focusConceptLabel: focusConcept.learnerLabel,
      sessionMode,
      rationaleCode,
    });

    if (snapshot.persona?.focusConceptId !== decision.focusConceptId) {
      await this.prisma.learnerProgrammingPersona.update({
        where: { learnerId },
        data: {
          focusConceptId: decision.focusConceptId,
        },
      });
    }

    return decision;
  }

  async buildDailySessionPlan(learnerId: string) {
    const decision = await this.getProgrammingState(learnerId);
    const tasks = await this.curriculumService.getPracticeTasks();
    const allowedTasks = tasks.filter((task) =>
      this.includesString(task.modeTags, decision.sessionMode),
    );

    const selectedIds = new Set<string>();
    const selectedTasks = [] as typeof tasks;

    const selectTask = (
      predicate: (task: (typeof tasks)[number]) => boolean,
    ) => {
      const match = allowedTasks.find(
        (task) => !selectedIds.has(task.id) && predicate(task),
      );

      if (!match) {
        return;
      }

      selectedIds.add(match.id);
      selectedTasks.push(match);
    };

    const focusTasks = allowedTasks.filter(
      (task) => task.conceptId === decision.focusConceptId,
    );
    const tracingTasks = allowedTasks.filter(
      (task) =>
        task.taskType === "trace_reasoning" ||
        task.conceptId === "py_c05_tracing_state",
    );
    const debuggingTasks = allowedTasks.filter(
      (task) => task.taskType === "bug_spotting",
    );

    if (decision.sessionMode === SessionMode.recovery_mode) {
      selectTask(
        (task) =>
          task.conceptId === decision.focusConceptId &&
          task.difficulty === "easy" &&
          task.taskType !== "code_completion",
      );
      selectTask(
        (task) =>
          task.taskType !== "code_completion" &&
          task.difficulty === "easy",
      );
      selectTask(
        (task) =>
          task.conceptId === decision.focusConceptId &&
          task.taskType !== "code_completion",
      );
    } else if (decision.sessionMode === SessionMode.debugging_drill) {
      selectTask(
        (task) =>
          debuggingTasks.some((debugTask) => debugTask.id === task.id) &&
          task.conceptId === decision.focusConceptId,
      );
      selectTask((task) =>
        debuggingTasks.some((debugTask) => debugTask.id === task.id),
      );
      selectTask((task) =>
        tracingTasks.some((traceTask) => traceTask.id === task.id),
      );
      selectTask((task) => task.conceptId === decision.focusConceptId);
    } else if (decision.sessionMode === SessionMode.concept_repair) {
      selectTask(
        (task) =>
          task.conceptId === decision.focusConceptId &&
          task.taskType !== "bug_spotting",
      );
      selectTask(
        (task) =>
          task.conceptId === decision.focusConceptId &&
          task.taskType !== "bug_spotting",
      );
      selectTask((task) => task.conceptId === decision.focusConceptId);
      selectTask(
        (task) =>
          task.conceptId === decision.focusConceptId ||
          task.taskType === "trace_reasoning",
      );
    } else {
      selectTask((task) => task.conceptId === decision.focusConceptId);
      selectTask((task) => task.conceptId === decision.focusConceptId);
      selectTask((task) =>
        tracingTasks.some((traceTask) => traceTask.id === task.id),
      );
      selectTask(
        (task) =>
          task.conceptId === decision.focusConceptId &&
          task.difficulty === "easy",
      );
    }

    const targetLength =
      decision.sessionMode === SessionMode.recovery_mode ? 3 : 4;

    for (const task of allowedTasks) {
      if (selectedTasks.length >= targetLength) {
        break;
      }

      if (selectedIds.has(task.id)) {
        continue;
      }

      if (
        decision.sessionMode === SessionMode.recovery_mode &&
        task.taskType === "code_completion"
      ) {
        continue;
      }

      if (
        decision.sessionMode === SessionMode.concept_repair &&
        selectedTasks.filter((item) => item.taskType === "bug_spotting").length >= 1 &&
        task.taskType === "bug_spotting"
      ) {
        continue;
      }

      selectedIds.add(task.id);
      selectedTasks.push(task);
    }

    return {
      decision,
      tasks: selectedTasks.slice(0, targetLength),
    };
  }

  private selectFocusConcept(input: {
    concepts: Awaited<ReturnType<CurriculumService["getProgrammingConcepts"]>>;
    snapshot: Awaited<ReturnType<LearnerProgressService["getPersonaSnapshot"]>>;
    recentIncorrectAttempts: Array<{
      questionItem: {
        topicId: string;
      };
    }>;
  }) {
    const recentConceptId =
      input.recentIncorrectAttempts[0]?.questionItem.topicId ?? null;

    if (recentConceptId) {
      const recentConcept = input.concepts.find(
        (concept) => concept.id === recentConceptId,
      );

      if (recentConcept) {
        return recentConcept;
      }
    }

    if (input.snapshot.persona?.focusConceptId) {
      const personaFocusConcept = input.concepts.find(
        (concept) => concept.id === input.snapshot.persona?.focusConceptId,
      );

      if (personaFocusConcept) {
        return personaFocusConcept;
      }
    }

    const emergingConceptState = input.snapshot.conceptStates.find(
      (state) => state.masteryState === MasteryState.emerging,
    );

    if (emergingConceptState) {
      return input.concepts.find(
        (concept) => concept.id === emergingConceptState.conceptId,
      );
    }

    return input.concepts[0] ?? null;
  }

  private buildDecision(input: {
    focusConceptId: string;
    focusConceptLabel: string;
    sessionMode: SessionMode;
    rationaleCode: PlannerDecision["rationaleCode"];
  }): PlannerDecision {
    const sessionModeLabelMap: Record<SessionMode, string> = {
      steady_practice: "Steady practice",
      concept_repair: "Concept repair",
      debugging_drill: "Debugging drill",
      recovery_mode: "Recovery mode",
    };

    const programmingStateCodeMap: Record<
      SessionMode,
      PlannerDecision["programmingStateCode"]
    > = {
      steady_practice: "steady_progress",
      concept_repair: "building_foundations",
      debugging_drill: "debugging_focus",
      recovery_mode: "recovery_needed",
    };

    const programmingStateLabelMap: Record<
      PlannerDecision["programmingStateCode"],
      string
    > = {
      building_foundations: "Building foundations",
      debugging_focus: "Debugging focus",
      steady_progress: "Steady progress",
      recovery_needed: "Recovery needed",
    };

    const rationaleTextMap: Record<PlannerDecision["rationaleCode"], string> = {
      recent_concept_errors:
        "Recent work suggests one concept still needs a steadier pass.",
      repeated_debugging_errors:
        "Recent mistakes suggest debugging practice may help most right now.",
      strong_recent_progress:
        "Recent work suggests you are ready for a steady practice session.",
      recent_dropoff:
        "Recent work suggests a shorter recovery session is the right next step.",
    };

    const nextStepTextMap: Record<SessionMode, string> = {
      steady_practice: "Work through a short Python practice session.",
      concept_repair: "Focus on one concept before moving on.",
      debugging_drill: "Work through debugging one step at a time.",
      recovery_mode: "Start with a shorter session designed to get you moving again.",
    };

    const programmingStateCode = programmingStateCodeMap[input.sessionMode];

    return {
      programmingStateCode,
      programmingStateLabel: programmingStateLabelMap[programmingStateCode],
      focusConceptId: input.focusConceptId,
      focusConceptLabel: input.focusConceptLabel,
      sessionMode: input.sessionMode,
      sessionModeLabel: sessionModeLabelMap[input.sessionMode],
      rationaleCode: input.rationaleCode,
      rationaleText: rationaleTextMap[input.rationaleCode],
      nextStepText: nextStepTextMap[input.sessionMode],
    };
  }

  private includesString(input: Prisma.JsonValue | null, expected: string) {
    if (!Array.isArray(input)) {
      return false;
    }

    return input.some((value) => value === expected);
  }
}
