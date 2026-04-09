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

export type ActiveUnit = {
  activeUnitId: string;
  sequenceOrder: number;
  learnerFacingLabel: string;
};

export type CurrentItem = {
  sessionItemId: string;
  questionItemId: string;
  topicId: string;
  questionType: "multiple_choice" | "numeric_input" | "expression_choice";
  stem: string;
  choices: string[];
  inputMode: string;
};

export type SessionPayload = {
  sessionId: string;
  status: "generated" | "in_progress" | "completed";
  currentIndex: number;
  totalItems: number;
  checkpointToken: string;
  currentItem: CurrentItem;
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
};

export type TodaySummary = {
  examDate: string;
  daysToExam: number;
  readinessBand: string;
  primaryActionLabel: string;
  hasActiveDailySession: boolean;
};

export type SessionSummary = {
  sessionId: string;
  totalItems: number;
  correctCount: number;
  incorrectCount: number;
};

export type AdminLearnerLookup = {
  learnerId: string;
  onboardingComplete: boolean;
  progressState: string;
  activeUnitId: string;
  readinessBand: string;
  activeDiagnosticSessionId: string;
  activeDailySessionId: string;
  topicStates: Array<{
    topicId: string;
    topicTitle: string;
    masteryState: string;
    prereqRiskState: string;
    validEvidenceCount: number;
    nextReviewDueAt: string;
  }>;
  recentAttempts: Array<{
    sessionId: string;
    sessionItemId: string;
    questionItemId: string;
    answerOutcome: string;
    createdAt: string;
  }>;
};

export type AdminRecentLearner = {
  learnerId: string;
  progressState: string;
  activeUnitId: string;
  readinessBand: string;
  activeDiagnosticSessionId: string;
  activeDailySessionId: string;
  lastActivityAt: string;
};

export type AdminSessionPreview = {
  sessionId: string;
  sessionType: string;
  status: string;
  currentIndex: number;
  totalItems: number;
  items: Array<{
    sessionItemId: string;
    sequenceOrder: number;
    slotType: string;
    questionItemId: string;
    topicId: string;
    isActive: boolean;
  }>;
};

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

export async function createOrResumeDiagnostic(): Promise<SessionPayload> {
  const learnerId = getLearnerId();
  const response = await fetch(`${getApiBaseUrl()}/diagnostic/create-or-resume`, {
    method: "POST",
    headers: learnerId ? { "x-learner-id": learnerId } : {},
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to create or resume diagnostic");
  }

  return response.json();
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

  return response.json();
}

export async function createOrResumeDailySession(): Promise<SessionPayload> {
  const learnerId = getLearnerId();
  const response = await fetch(`${getApiBaseUrl()}/session/create-or-resume`, {
    method: "POST",
    headers: learnerId ? { "x-learner-id": learnerId } : {},
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to create or resume daily session");
  }

  return response.json();
}

export async function submitAnswer(input: {
  sessionId: string;
  sessionItemId: string;
  answerValue: string;
  checkpointToken: string;
}) {
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

export async function submitOnboarding(input: {
  examDate: string;
  activeUnitId: string;
}) {
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

  const payload = (await response.json()) as {
    learnerId: string;
    onboardingComplete: boolean;
    nextRoute: "/diagnostic";
  };

  setLearnerId(payload.learnerId);

  return payload;
}

export async function fetchTodaySummary(): Promise<TodaySummary> {
  const learnerId = getLearnerId();
  const response = await fetch(`${getApiBaseUrl()}/today`, {
    cache: "no-store",
    headers: learnerId ? { "x-learner-id": learnerId } : {},
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to load today summary");
  }

  return response.json();
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

  return response.json();
}

export async function fetchActiveUnits(): Promise<ActiveUnit[]> {
  const response = await fetch("/api/mock/active-units", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load active units");
  }

  return response.json();
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
    const payload = (await response.json()) as { message?: string };
    return new ApiError(payload.message ?? fallbackMessage, response.status);
  } catch {
    return new ApiError(fallbackMessage, response.status);
  }
}
