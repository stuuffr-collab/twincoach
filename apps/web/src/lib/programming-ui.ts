import type {
  HelpKind,
  ProgrammingStateCode,
  ProgrammingTaskType,
  SessionMode,
} from "@/src/lib/api";

export function getProgrammingTaskTypeLabel(taskType: ProgrammingTaskType) {
  const labels: Record<ProgrammingTaskType, string> = {
    output_prediction: "توقّع المخرجات",
    trace_reasoning: "تتبّع التنفيذ",
    bug_spotting: "التقاط الخطأ",
    code_completion: "إكمال الكود",
    concept_choice: "اختيار الفكرة",
  };

  return labels[taskType];
}

export function getHelpKindLabel(helpKind: HelpKind) {
  const labels: Record<HelpKind, string> = {
    step_breakdown: "تفكيك الخطوات",
    worked_example: "مثال محلول",
    debugging_hint: "تلميح للإصلاح",
    concept_explanation: "شرح الفكرة",
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
    steady_practice: "تدريب ثابت",
    concept_repair: "تقوية الفكرة",
    debugging_drill: "تدريب على الإصلاح",
    recovery_mode: "عودة هادئة",
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

export function getProgrammingStateLabel(code: ProgrammingStateCode) {
  const labels: Record<ProgrammingStateCode, string> = {
    building_foundations: "نبني الأساس",
    debugging_focus: "نركّز على الإصلاح",
    steady_progress: "تقدّم ثابت",
    recovery_needed: "نحتاج عودة هادئة",
  };

  return labels[code];
}
