import { getAdminKey } from "@/src/lib/admin-access";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
const LEARNER_ID_STORAGE_KEY = "twincoach.learnerId";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type BootState = {
  learnerId: string;
  onboardingComplete: boolean;
  hasActiveDiagnostic: boolean;
  hasCompletedDiagnostic: boolean;
  hasActiveDailySession: boolean;
  nextRoute: "/onboarding" | "/diagnostic" | "/today";
};

export type PriorProgrammingExposure =
  | "none"
  | "school_basics"
  | "self_taught_basics"
  | "completed_intro_course";

export type CurrentComfortLevel = "very_low" | "low" | "medium";

export type BiggestDifficulty =
  | "reading_code"
  | "writing_syntax"
  | "tracing_logic"
  | "debugging_errors";

export type HelpKind =
  | "step_breakdown"
  | "worked_example"
  | "debugging_hint"
  | "concept_explanation";

export type ProgrammingTaskType =
  | "output_prediction"
  | "trace_reasoning"
  | "bug_spotting"
  | "code_completion"
  | "concept_choice";

export type AnswerFormat = "single_choice" | "short_text";

export type SessionMode =
  | "steady_practice"
  | "concept_repair"
  | "debugging_drill"
  | "recovery_mode";

export type ProgrammingStateCode =
  | "building_foundations"
  | "debugging_focus"
  | "steady_progress"
  | "recovery_needed";

export type RationaleCode =
  | "recent_concept_errors"
  | "repeated_debugging_errors"
  | "strong_recent_progress"
  | "recent_dropoff";

export type MomentumState = "unknown" | "low" | "steady" | "strong";
export type StabilityState = "unknown" | "fragile" | "developing" | "steady";
export type ResilienceState = "unknown" | "fragile" | "recovering" | "steady";
export type MasteryState = "unknown" | "emerging" | "steady";

export type ProgrammingErrorTag =
  | "syntax_form_error"
  | "value_tracking_error"
  | "branch_logic_error"
  | "loop_control_error"
  | "function_usage_error"
  | "debugging_strategy_error";

export type ProgrammingTaskChoice = {
  choiceId: string;
  label: string;
};

export type ProgrammingTaskBase = {
  sessionItemId: string;
  taskId: string;
  conceptId: string;
  taskType: ProgrammingTaskType;
  prompt: string;
  codeSnippet: string | null;
  choices: ProgrammingTaskChoice[];
  answerFormat: AnswerFormat;
  helperText: string;
};

export type DiagnosticTaskPayload = ProgrammingTaskBase;

export type DailyTaskPayload = ProgrammingTaskBase & {
  helpAvailable: boolean;
  helpKind: HelpKind | null;
  helpLabel: string | null;
};

export type DiagnosticSessionPayload = {
  sessionId: string;
  sessionType: "diagnostic";
  status: "generated" | "in_progress" | "completed";
  currentIndex: number;
  totalItems: number;
  checkpointToken: string;
  currentTask: DiagnosticTaskPayload;
};

export type DailySessionPayload = {
  sessionId: string;
  sessionType: "daily_practice";
  status: "generated" | "in_progress" | "completed";
  sessionMode: SessionMode;
  sessionModeLabel: string;
  focusConceptId: string | null;
  focusConceptLabel: string;
  currentIndex: number;
  totalItems: number;
  checkpointToken: string;
  currentTask: DailyTaskPayload;
};

export type SessionPayload = DiagnosticSessionPayload | DailySessionPayload;

export type HelpOffer = {
  helpKind: HelpKind;
  label: string;
  text: string;
};

export type AnswerSubmitResponse = {
  isCorrect: boolean;
  feedbackType:
    | "correct"
    | "needs_review"
    | "try_fix"
    | "needs_another_check";
  feedbackText: string;
  sessionStatus: "generated" | "in_progress" | "completed";
  helpOffer?: HelpOffer;
};

export type OnboardingPayload = {
  priorProgrammingExposure: PriorProgrammingExposure;
  currentComfortLevel: CurrentComfortLevel;
  biggestDifficulty: BiggestDifficulty;
  preferredHelpStyle: HelpKind;
};

export type OnboardingResponse = {
  learnerId: string;
  onboardingComplete: boolean;
  nextRoute: "/diagnostic";
};

export type ProgrammingState = {
  screenTitle: "Your Programming State";
  programmingStateCode: ProgrammingStateCode;
  programmingStateLabel: string;
  focusConceptId: string;
  focusConceptLabel: string;
  sessionMode: SessionMode;
  sessionModeLabel: string;
  rationaleCode: RationaleCode;
  rationaleText: string;
  nextStepText: string;
  primaryActionLabel: "Start today's session" | "Resume today's session";
  hasActiveDailySession: boolean;
  activeSessionId: string | null;
};

export type SessionSummary = {
  sessionId: string;
  sessionMode: SessionMode | null;
  focusConceptId: string | null;
  focusConceptLabel: string;
  completedTaskCount: number;
  correctCount: number;
  incorrectCount: number;
  whatImproved: {
    code: string;
    label: string;
    text: string;
  };
  whatNeedsSupport: {
    code: string;
    conceptId: string;
    label: string;
    text: string;
  };
  studyPatternObserved: {
    code: string;
    label: string;
    text: string;
  };
  nextBestAction: {
    route: "/today";
    label: string;
    text: string;
  };
};

export type AdminRecentLearner = {
  learnerId: string;
  focusConceptId: string;
  focusConceptLabel: string;
  sessionMode: SessionMode | null;
  sessionMomentumState: MomentumState;
  activeDiagnosticSessionId: string;
  activeDailySessionId: string;
  lastActivityAt: string;
};

export type AdminLearnerLookup = {
  learnerId: string;
  onboardingProfile: {
    priorProgrammingExposure: PriorProgrammingExposure;
    currentComfortLevel: CurrentComfortLevel;
    biggestDifficulty: BiggestDifficulty;
    preferredHelpStyle: HelpKind;
  } | null;
  personaSnapshot: {
    focusConceptId: string;
    focusConceptLabel: string;
    preferredHelpStyle: HelpKind | "";
    syntaxStabilityState: StabilityState;
    logicTracingState: StabilityState;
    debuggingResilienceState: ResilienceState;
    sessionMomentumState: MomentumState;
    conceptStates: Array<{
      conceptId: string;
      conceptLabel: string;
      masteryState: MasteryState;
      recentErrorTag: ProgrammingErrorTag | null;
      lastObservedAt: string;
    }>;
  };
  activeDiagnosticSessionId: string;
  activeDailySessionId: string;
  recentErrorTags: Array<{
    primaryErrorTag: ProgrammingErrorTag | null;
    createdAt: string;
    sessionId: string;
    sessionItemId: string;
  }>;
  latestSummarySnapshot: {
    sessionId: string;
    sessionMode: SessionMode | null;
    focusConceptId: string;
    focusConceptLabel: string;
    completedAt: string;
    whatImproved: {
      code: string;
    };
    whatNeedsSupport: {
      code: string;
    };
    studyPatternObserved: {
      code: string;
    };
  } | null;
};

export type AdminSessionPreview = {
  sessionId: string;
  sessionType: string;
  sessionMode: SessionMode | null;
  focusConceptId: string | null;
  focusConceptLabel: string;
  status: string;
  currentIndex: number;
  totalItems: number;
  items: Array<{
    sessionItemId: string;
    sequenceOrder: number;
    taskId: string;
    conceptId: string;
    conceptLabel: string;
    taskType: ProgrammingTaskType;
    isActive: boolean;
  }>;
};

export type TelemetryEventName =
  | "tc_diagnostic_task_viewed"
  | "tc_diagnostic_answer_submitted"
  | "tc_session_task_viewed"
  | "tc_session_answer_submitted"
  | "tc_session_help_revealed";

export type TelemetryEventRequest = {
  eventName: TelemetryEventName;
  route: string;
  sessionId?: string;
  sessionItemId?: string;
  properties: Record<string, string | number | boolean | null>;
};

export function isDailyPracticeSession(
  payload: SessionPayload,
): payload is DailySessionPayload {
  return payload.sessionType === "daily_practice";
}

export async function fetchBootState(): Promise<BootState> {
  const learnerId = getLearnerId();
  const response = await fetch(`${getApiBaseUrl()}/boot`, {
    cache: "no-store",
    headers: learnerId ? { "x-learner-id": learnerId } : {},
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to fetch boot state");
  }

  const payload = (await response.json()) as BootState;

  if (payload.learnerId) {
    setLearnerId(payload.learnerId);
  }

  return payload;
}

export async function submitOnboarding(
  input: OnboardingPayload,
): Promise<OnboardingResponse> {
  const learnerId = getLearnerId();
  const response = await fetch(`${getApiBaseUrl()}/onboarding/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(learnerId ? { "x-learner-id": learnerId } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to save onboarding");
  }

  const payload = (await response.json()) as OnboardingResponse;
  setLearnerId(payload.learnerId);

  return payload;
}

export async function createOrResumeDiagnostic(): Promise<DiagnosticSessionPayload> {
  const learnerId = getLearnerId();
  const response = await fetch(`${getApiBaseUrl()}/diagnostic/create-or-resume`, {
    method: "POST",
    headers: learnerId ? { "x-learner-id": learnerId } : {},
  });

  if (!response.ok) {
    throw await createApiError(
      response,
      "Failed to create or resume diagnostic",
    );
  }

  return (await response.json()) as DiagnosticSessionPayload;
}

export async function fetchSession(sessionId: string): Promise<SessionPayload> {
  const learnerId = getLearnerId();
  const response = await fetch(`${getApiBaseUrl()}/session/${sessionId}`, {
    cache: "no-store",
    headers: learnerId ? { "x-learner-id": learnerId } : {},
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to fetch session");
  }

  return (await response.json()) as SessionPayload;
}

export async function createOrResumeDailySession(): Promise<DailySessionPayload> {
  const learnerId = getLearnerId();
  const response = await fetch(`${getApiBaseUrl()}/session/create-or-resume`, {
    method: "POST",
    headers: learnerId ? { "x-learner-id": learnerId } : {},
  });

  if (!response.ok) {
    throw await createApiError(
      response,
      "Failed to create or resume daily session",
    );
  }

  return (await response.json()) as DailySessionPayload;
}

export async function submitAnswer(input: {
  sessionId: string;
  sessionItemId: string;
  answerValue: string;
  checkpointToken: string;
}): Promise<AnswerSubmitResponse> {
  const learnerId = getLearnerId();
  const response = await fetch(`${getApiBaseUrl()}/session/${input.sessionId}/answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(learnerId ? { "x-learner-id": learnerId } : {}),
    },
    body: JSON.stringify({
      sessionItemId: input.sessionItemId,
      answerValue: input.answerValue,
      checkpointToken: input.checkpointToken,
    }),
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to submit answer");
  }

  return (await response.json()) as AnswerSubmitResponse;
}

export async function fetchTodaySummary(): Promise<ProgrammingState> {
  const learnerId = getLearnerId();
  const response = await fetch(`${getApiBaseUrl()}/today`, {
    cache: "no-store",
    headers: learnerId ? { "x-learner-id": learnerId } : {},
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to load programming state");
  }

  return (await response.json()) as ProgrammingState;
}

export async function fetchSessionSummary(
  sessionId: string,
): Promise<SessionSummary> {
  const learnerId = getLearnerId();
  const response = await fetch(`${getApiBaseUrl()}/session/${sessionId}/summary`, {
    cache: "no-store",
    headers: learnerId ? { "x-learner-id": learnerId } : {},
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to load session summary");
  }

  return (await response.json()) as SessionSummary;
}

export async function recordTelemetryEvent(
  input: TelemetryEventRequest,
): Promise<void> {
  const learnerId = getLearnerId();

  if (!learnerId) {
    return;
  }

  const response = await fetch(`${getApiBaseUrl()}/telemetry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-learner-id": learnerId,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to record telemetry");
  }
}

export async function fetchAdminLearner(
  learnerId: string,
): Promise<AdminLearnerLookup> {
  const adminKey = getAdminKey();
  const response = await fetch(`${getApiBaseUrl()}/admin/learner/${learnerId}`, {
    cache: "no-store",
    headers: adminKey ? { "x-admin-key": adminKey } : {},
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to load learner lookup");
  }

  return response.json();
}

export async function fetchRecentAdminLearners(): Promise<AdminRecentLearner[]> {
  const adminKey = getAdminKey();
  const response = await fetch(`${getApiBaseUrl()}/admin/learners/recent`, {
    cache: "no-store",
    headers: adminKey ? { "x-admin-key": adminKey } : {},
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to load recent learners");
  }

  return response.json();
}

export async function fetchAdminSessionPreview(
  sessionId: string,
): Promise<AdminSessionPreview> {
  const adminKey = getAdminKey();
  const response = await fetch(`${getApiBaseUrl()}/admin/session/${sessionId}/preview`, {
    cache: "no-store",
    headers: adminKey ? { "x-admin-key": adminKey } : {},
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to load session preview");
  }

  return response.json();
}

export async function deactivateAdminItem(questionItemId: string) {
  const adminKey = getAdminKey();
  const response = await fetch(`${getApiBaseUrl()}/admin/item/${questionItemId}/deactivate`, {
    method: "POST",
    headers: adminKey ? { "x-admin-key": adminKey } : {},
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to deactivate item");
  }

  return response.json() as Promise<{
    questionItemId: string;
    isActive: boolean;
  }>;
}

export function getLearnerId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(LEARNER_ID_STORAGE_KEY) ?? "";
}

function setLearnerId(learnerId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LEARNER_ID_STORAGE_KEY, learnerId);
}

function getApiBaseUrl() {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is required");
  }

  return API_BASE_URL;
}

async function createApiError(response: Response, fallbackMessage: string) {
  try {
    const payload = (await response.json()) as {
      message?: string | string[];
    };
    const message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message;

    return new ApiError(message ?? fallbackMessage, response.status);
  } catch {
    return new ApiError(fallbackMessage, response.status);
  }
}
