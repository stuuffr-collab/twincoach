import type {
  HelpKind,
  ProgrammingStateCode,
  ProgrammingTaskType,
  SessionMode,
} from "@/src/lib/api";

export function getProgrammingTaskTypeLabel(taskType: ProgrammingTaskType) {
  const labels: Record<ProgrammingTaskType, string> = {
    output_prediction: "Output prediction",
    trace_reasoning: "Trace reasoning",
    bug_spotting: "Bug spotting",
    code_completion: "Code completion",
    concept_choice: "Concept choice",
  };

  return labels[taskType];
}

export function getHelpKindLabel(helpKind: HelpKind) {
  const labels: Record<HelpKind, string> = {
    step_breakdown: "Step breakdown",
    worked_example: "Worked example",
    debugging_hint: "Debugging hint",
    concept_explanation: "Concept explanation",
  };

  return labels[helpKind];
}

export function getSessionModeTone(mode: SessionMode) {
  const tones: Record<SessionMode, string> = {
    steady_practice: "border-emerald-200 bg-emerald-50 text-emerald-900",
    concept_repair: "border-blue-200 bg-blue-50 text-blue-900",
    debugging_drill: "border-amber-200 bg-amber-50 text-amber-900",
    recovery_mode: "border-slate-200 bg-slate-50 text-slate-900",
  };

  return tones[mode];
}

export function getSessionModeLabel(mode: SessionMode) {
  const labels: Record<SessionMode, string> = {
    steady_practice: "Steady practice",
    concept_repair: "Concept repair",
    debugging_drill: "Debugging drill",
    recovery_mode: "Recovery mode",
  };

  return labels[mode];
}

export function getProgrammingStateTone(code: ProgrammingStateCode) {
  const tones: Record<ProgrammingStateCode, string> = {
    building_foundations: "border-blue-200 bg-blue-50 text-blue-900",
    debugging_focus: "border-amber-200 bg-amber-50 text-amber-900",
    steady_progress: "border-emerald-200 bg-emerald-50 text-emerald-900",
    recovery_needed: "border-slate-200 bg-slate-50 text-slate-900",
  };

  return tones[code];
}
