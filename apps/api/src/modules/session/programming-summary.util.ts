import { ProgrammingErrorTag, SessionMode } from "@prisma/client";

type SummaryAttempt = {
  isCorrect: boolean | null;
  primaryErrorTag: ProgrammingErrorTag | null;
  helpKindUsed: string | null;
};

export type ProgrammingSummaryCodeBundle = {
  correctCount: number;
  incorrectCount: number;
  whatImprovedCode:
    | "concept_strengthened"
    | "debugging_recovery"
    | "steady_completion";
  whatNeedsSupportCode:
    | "concept_still_needs_support"
    | "syntax_still_fragile"
    | "debugging_still_needs_structure";
  studyPatternCode:
    | "recovered_after_mistake"
    | "steady_throughout"
    | "hesitated_but_completed"
    | "needed_hint_to_progress";
};

export function deriveProgrammingSummaryCodes(input: {
  sessionMode: SessionMode | null;
  totalItems: number;
  attempts: SummaryAttempt[];
}): ProgrammingSummaryCodeBundle {
  const correctCount = input.attempts.filter((attempt) => attempt.isCorrect).length;
  const incorrectCount = input.attempts.length - correctCount;
  const lastTaggedAttempt = [...input.attempts]
    .reverse()
    .find((attempt) => attempt.primaryErrorTag !== null);

  const whatImprovedCode =
    incorrectCount > 0 && correctCount > 0
      ? "debugging_recovery"
      : correctCount >= Math.ceil(input.totalItems / 2)
        ? "concept_strengthened"
        : "steady_completion";
  const whatNeedsSupportCode =
    lastTaggedAttempt?.primaryErrorTag === ProgrammingErrorTag.syntax_form_error
      ? "syntax_still_fragile"
      : input.sessionMode === SessionMode.debugging_drill && incorrectCount > 0
        ? "debugging_still_needs_structure"
        : "concept_still_needs_support";
  const studyPatternCode = input.attempts.some(
    (attempt) => attempt.helpKindUsed !== null,
  )
    ? "needed_hint_to_progress"
    : incorrectCount > 0 && correctCount > 0
      ? "recovered_after_mistake"
      : input.sessionMode === SessionMode.recovery_mode
        ? "hesitated_but_completed"
        : "steady_throughout";

  return {
    correctCount,
    incorrectCount,
    whatImprovedCode,
    whatNeedsSupportCode,
    studyPatternCode,
  };
}
