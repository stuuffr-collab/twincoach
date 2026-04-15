import type {
  OnboardingPayload,
  ProgrammingState,
  SessionMode,
  SessionSummary,
} from "@/src/lib/api";

const PROFILE_LITE_STORAGE_KEY = "twincoach.profileLite";

type StoredMode = {
  mode: SessionMode;
  recordedAt: string;
};

type StoredSummary = {
  sessionId: string;
  sessionMode: SessionMode | null;
  focusConceptLabel: string;
  whatImproved: SessionSummary["whatImproved"];
  whatNeedsSupport: SessionSummary["whatNeedsSupport"];
  studyPatternObserved: SessionSummary["studyPatternObserved"];
  nextBestAction: SessionSummary["nextBestAction"];
  completedTaskCount: number;
  correctCount: number;
  incorrectCount: number;
  capturedAt: string;
};

type StoredTodayState = {
  focusConceptLabel: string;
  sessionMode: SessionMode;
  sessionModeLabel: string;
  programmingStateLabel: string;
  rationaleText: string;
  nextStepText: string;
  capturedAt: string;
};

type LearnerProfileLiteStore = {
  onboardingProfile: OnboardingPayload | null;
  latestProgrammingState: StoredTodayState | null;
  latestSummary: StoredSummary | null;
  completedSessionIds: string[];
  recentModes: StoredMode[];
  lastCompletedAt: string | null;
};

const emptyStore: LearnerProfileLiteStore = {
  onboardingProfile: null,
  latestProgrammingState: null,
  latestSummary: null,
  completedSessionIds: [],
  recentModes: [],
  lastCompletedAt: null,
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readStore(): LearnerProfileLiteStore {
  if (!isBrowser()) {
    return emptyStore;
  }

  const rawValue = window.localStorage.getItem(PROFILE_LITE_STORAGE_KEY);

  if (!rawValue) {
    return emptyStore;
  }

  try {
    return {
      ...emptyStore,
      ...(JSON.parse(rawValue) as Partial<LearnerProfileLiteStore>),
    };
  } catch {
    return emptyStore;
  }
}

function writeStore(store: LearnerProfileLiteStore) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(PROFILE_LITE_STORAGE_KEY, JSON.stringify(store));
}

function pushRecentMode(recentModes: StoredMode[], mode: SessionMode) {
  const nextItem = {
    mode,
    recordedAt: new Date().toISOString(),
  };

  return [nextItem, ...recentModes.filter((item) => item.mode !== mode)].slice(0, 4);
}

export function persistOnboardingProfile(profile: OnboardingPayload) {
  const current = readStore();
  writeStore({
    ...current,
    onboardingProfile: profile,
  });
}

export function persistProgrammingState(summary: ProgrammingState) {
  const current = readStore();

  writeStore({
    ...current,
    latestProgrammingState: {
      focusConceptLabel: summary.focusConceptLabel,
      sessionMode: summary.sessionMode,
      sessionModeLabel: summary.sessionModeLabel,
      programmingStateLabel: summary.programmingStateLabel,
      rationaleText: summary.rationaleText,
      nextStepText: summary.nextStepText,
      capturedAt: new Date().toISOString(),
    },
    recentModes: pushRecentMode(current.recentModes, summary.sessionMode),
  });
}

export function persistRecentMode(mode: SessionMode) {
  const current = readStore();
  writeStore({
    ...current,
    recentModes: pushRecentMode(current.recentModes, mode),
  });
}

export function persistSessionSummary(summary: SessionSummary) {
  const current = readStore();
  const completedSessionIds = current.completedSessionIds.includes(summary.sessionId)
    ? current.completedSessionIds
    : [summary.sessionId, ...current.completedSessionIds];

  writeStore({
    ...current,
    latestSummary: {
      sessionId: summary.sessionId,
      sessionMode: summary.sessionMode,
      focusConceptLabel: summary.focusConceptLabel,
      whatImproved: summary.whatImproved,
      whatNeedsSupport: summary.whatNeedsSupport,
      studyPatternObserved: summary.studyPatternObserved,
      nextBestAction: summary.nextBestAction,
      completedTaskCount: summary.completedTaskCount,
      correctCount: summary.correctCount,
      incorrectCount: summary.incorrectCount,
      capturedAt: new Date().toISOString(),
    },
    completedSessionIds: completedSessionIds.slice(0, 20),
    recentModes: summary.sessionMode
      ? pushRecentMode(current.recentModes, summary.sessionMode)
      : current.recentModes,
    lastCompletedAt: new Date().toISOString(),
  });
}

export function readLearnerProfileLite() {
  return readStore();
}
