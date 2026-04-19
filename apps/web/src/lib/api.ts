import { getAdminKey } from "@/src/lib/admin-access";
import {
  persistOnboardingProfile,
  persistProgrammingState,
  persistRecentMode,
  persistSessionSummary,
} from "@/src/lib/learner-profile-lite";

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

export type ActiveCourseContext = {
  coursePackId: string;
  courseTitle: string;
  supportLevel:
    | "full_coach"
    | "guided_study"
    | "planning_review"
    | "not_ready";
  focusNormalizedConceptId: string | null;
  focusNormalizedConceptLabel: string | null;
  focusEngineConceptId: string | null;
  activatedAt: string;
  refreshContext: {
    reasonType:
      | "changed_concept"
      | "changed_blueprint_priority"
      | "support_level_impact"
      | "new_material";
    sourceLabel: string | null;
    previousSupportLevel:
      | "full_coach"
      | "guided_study"
      | "planning_review"
      | "not_ready"
      | null;
    currentSupportLevel:
      | "full_coach"
      | "guided_study"
      | "planning_review"
      | "not_ready";
    firstSessionPending: boolean;
  } | null;
  followThrough: {
    targetNormalizedConceptId: string;
    targetLabel: string | null;
    reasonType:
      | "changed_concept"
      | "changed_blueprint_priority"
      | "support_level_impact"
      | "new_material";
  } | null;
  resolution: {
    resolvedNormalizedConceptId: string;
    resolvedLabel: string | null;
    reasonType:
      | "changed_concept"
      | "changed_blueprint_priority"
      | "support_level_impact"
      | "new_material";
  } | null;
};

export type PackProgressMemory = {
  recentFocusHistory: Array<{
    normalizedConceptId: string | null;
    label: string;
    observedAt: string;
    status: "current" | "recently_resolved" | "recent";
    isRecurring: boolean;
  }>;
  recentlyStabilized: {
    normalizedConceptId: string | null;
    label: string;
  } | null;
  recurring: {
    normalizedConceptId: string | null;
    label: string;
    reason: "repeat_focus" | "recent_support_signal";
    repeatCount: number;
  } | null;
  carryForward: {
    label: string;
    reason: "recently_stabilized" | "recent_focus_chain" | "recurring_area";
  } | null;
};

export type RecurringFocusDecision = {
  decisionType:
    | "staying_with_recurring_area"
    | "escalating_recurring_area"
    | "rotating_from_recurring_area"
    | "rotating_after_stabilization"
    | "returning_to_resolved_area"
    | "holding_against_recent_residue";
  currentFocusNormalizedConceptId: string | null;
  currentFocusLabel: string;
  sourceNormalizedConceptId: string | null;
  sourceLabel: string;
  repeatCount: number | null;
  reasonCode:
    | "repeat_focus"
    | "recent_support_signal"
    | "area_stabilized"
    | "genuine_resurfacing"
    | "recent_memory_residue";
  nextStepIntent: "stay" | "move_on";
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
  activeCourseContext: ActiveCourseContext | null;
};

export type DailySessionPayload = {
  sessionId: string;
  sessionType: "daily_practice";
  status: "generated" | "in_progress" | "completed";
  sessionMode: SessionMode;
  sessionModeLabel: string;
  focusConceptId: string | null;
  focusConceptLabel: string;
  focusCompiledConceptId: string | null;
  refreshHandoff: {
    reasonType:
      | "changed_concept"
      | "changed_blueprint_priority"
      | "support_level_impact"
      | "new_material";
    sourceLabel: string | null;
    previousSupportLevel:
      | "full_coach"
      | "guided_study"
      | "planning_review"
      | "not_ready"
      | null;
    currentSupportLevel:
      | "full_coach"
      | "guided_study"
      | "planning_review"
      | "not_ready";
    isFirstSessionAfterRefresh: boolean;
    isFollowThroughSession: boolean;
    isResolutionSession: boolean;
  } | null;
  recurringFocusDecision: RecurringFocusDecision | null;
  currentIndex: number;
  totalItems: number;
  checkpointToken: string;
  currentTask: DailyTaskPayload;
  activeCourseContext: ActiveCourseContext | null;
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
  screenTitle: string;
  programmingStateCode: ProgrammingStateCode;
  programmingStateLabel: string;
  focusConceptId: string;
  focusConceptLabel: string;
  focusCompiledConceptId: string | null;
  sessionMode: SessionMode;
  sessionModeLabel: string;
  rationaleCode: RationaleCode;
  rationaleText: string;
  nextStepText: string;
  activeCourseContext: ActiveCourseContext | null;
  packProgressMemory: PackProgressMemory | null;
  recurringFocusDecision: RecurringFocusDecision | null;
  primaryActionLabel: string;
  hasActiveDailySession: boolean;
  activeSessionId: string | null;
};

export type SessionSummary = {
  sessionId: string;
  sessionMode: SessionMode | null;
  focusConceptId: string | null;
  focusConceptLabel: string;
  focusCompiledConceptId: string | null;
  refreshHandoff: {
    reasonType:
      | "changed_concept"
      | "changed_blueprint_priority"
      | "support_level_impact"
      | "new_material";
    sourceLabel: string | null;
    previousSupportLevel:
      | "full_coach"
      | "guided_study"
      | "planning_review"
      | "not_ready"
      | null;
    currentSupportLevel:
      | "full_coach"
      | "guided_study"
      | "planning_review"
      | "not_ready";
    isFirstSessionAfterRefresh: boolean;
    isFollowThroughSession: boolean;
    isResolutionSession: boolean;
  } | null;
  recurringFocusDecision: RecurringFocusDecision | null;
  activeCourseContext: ActiveCourseContext | null;
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
  activeCourseContext: AdminActiveCourseContext | null;
  sessionMode: SessionMode | null;
  sessionMomentumState: MomentumState;
  activeDiagnosticSessionId: string;
  activeDailySessionId: string;
  lastActivityAt: string;
};

export type AdminActiveCourseContext = ActiveCourseContext;

export type AdminCoursePackDocument = {
  documentId: string;
  originalFilename: string;
  validationStatus: string;
  parseStatus: string;
  suggestedRole: string | null;
  confirmedRole: string | null;
  roleConfidenceScore: number | null;
  parseConfidenceScore: number | null;
  warningCodes: string[];
  blockingIssueCode: string | null;
  uploadedAt: string;
};

export type AdminCoursePackExtraction = {
  extractionSnapshotId: string;
  coverageStatus: string;
  averageConfidenceScore: number;
  lowConfidenceItemCount: number;
  warningCodes: string[];
  unitCount: number;
  conceptCount: number;
  dependencyCount: number;
  themeCount: number;
  unsupportedTopicCount: number;
  generatedAt: string;
};

export type AdminCoursePackSupportLevelAssessment = {
  supportLevelAssessmentId: string;
  parseIntegrityScore: number;
  structureConfidenceScore: number;
  blueprintConfidenceScore: number;
  packCompletenessScore: number;
  coachableCoverageScore: number;
  evaluationReliabilityScore: number;
  candidateSupportLevel: string;
};

export type AdminCoursePackConfirmation = {
  confirmationSnapshotId: string;
  status: string;
  editedItemCount: number;
  mergeActionCount: number;
  lowConfidenceAcknowledged: boolean;
  lowConfidenceIncludedCount: number;
  confirmedUnitCount: number;
  confirmedConceptCount: number;
  confirmedAt: string;
  activatedAt: string | null;
};

export type AdminCoursePackCompilation = {
  compiledCoachPackId: string;
  compilationStatus: string;
  supportLevel: string;
  focusNormalizedConceptId: string | null;
  focusNormalizedConceptLabel: string | null;
  focusEngineConceptId: string | null;
  normalizedConceptCount: number;
  compiledAt: string;
};

export type AdminCoursePackOperationalView = {
  coursePackId: string;
  courseTitle: string;
  courseCode: string | null;
  institutionLabel: string | null;
  termLabel: string | null;
  lifecycleState: string;
  readinessState: string;
  supportLevelCandidate: string | null;
  supportLevelFinal: string | null;
  isActive: boolean;
  activeConfirmationSnapshotId: string | null;
  documentCount: number;
  confirmedUnitCount: number;
  confirmedConceptCount: number;
  unsupportedTopicCount: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  activatedAt: string | null;
  documents: AdminCoursePackDocument[];
  latestExtraction: AdminCoursePackExtraction | null;
  supportLevelAssessment: AdminCoursePackSupportLevelAssessment | null;
  latestConfirmation: AdminCoursePackConfirmation | null;
  activation: {
    isActive: boolean;
    supportLevelFinal: string | null;
    activatedAt: string | null;
    activeContext: AdminActiveCourseContext | null;
  };
  compilation: AdminCoursePackCompilation | null;
  unsupportedTopics: Array<{
    unsupportedTopicId: string;
    label: string;
    reasonCode: string;
    suggestedHandling: string;
  }>;
};

export type AdminLearnerLookup = {
  learnerId: string;
  activeCourseContext: AdminActiveCourseContext | null;
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
  coursePacks: AdminCoursePackOperationalView[];
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
  focusCompiledConceptId: string | null;
  activeCourseContext: AdminActiveCourseContext | null;
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

export type CoursePackSupportLevel =
  | "full_coach"
  | "guided_study"
  | "planning_review"
  | "not_ready";

export type CoursePackDriftStatus =
  | "clean"
  | "pending_refresh"
  | "review_required";

export type CoursePackActiveContextState = "current" | "stale";

export type CoursePackLifecycleState =
  | "draft"
  | "ingesting"
  | "classifying"
  | "extracting"
  | "awaiting_confirmation"
  | "confirmed"
  | "active"
  | "archived"
  | "failed";

export type CoursePackReadinessState =
  | "awaiting_documents"
  | "awaiting_roles"
  | "awaiting_extraction"
  | "review_ready"
  | "activation_ready"
  | "blocked";

export type CoursePackDocumentRole =
  | "syllabus"
  | "lecture_notes"
  | "slides"
  | "past_exam"
  | "lab_sheet"
  | "assignment"
  | "reference"
  | "other"
  | "unknown";

export type CoursePackDocumentValidationStatus =
  | "queued"
  | "valid"
  | "rejected";

export type CoursePackDocumentParseStatus =
  | "queued"
  | "validating"
  | "validated"
  | "parsing"
  | "parsed"
  | "partial"
  | "failed"
  | "blocked";

export type CoursePackDocument = {
  documentId: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  pageCount: number | null;
  checksumSha256: string;
  uploadedAt: string;
  validationStatus: CoursePackDocumentValidationStatus;
  suggestedRole: CoursePackDocumentRole | null;
  confirmedRole: CoursePackDocumentRole | null;
  roleConfidenceScore: number | null;
  roleReasonCodes: string[];
  alternateRoles: Array<{
    role: CoursePackDocumentRole;
    confidenceScore: number;
  }>;
  parseStatus: CoursePackDocumentParseStatus;
  parseConfidenceScore: number | null;
  hasSelectableText: boolean | null;
  textCoverageRatio: number | null;
  warningCodes: string[];
  blockingIssueCode: string | null;
};

export type CoursePackRecord = {
  coursePackId: string;
  learnerId: string;
  courseTitle: string;
  courseCode: string | null;
  institutionLabel: string | null;
  termLabel: string | null;
  primaryLanguage: string;
  lifecycleState: CoursePackLifecycleState;
  readinessState: CoursePackReadinessState;
  supportLevelCandidate: CoursePackSupportLevel | null;
  supportLevelFinal: CoursePackSupportLevel | null;
  driftStatus: CoursePackDriftStatus;
  driftReasonCodes: string[];
  requiresReconfirmation: boolean;
  activeContextState: CoursePackActiveContextState;
  isActive: boolean;
  documentCount: number;
  confirmedUnitCount: number;
  confirmedConceptCount: number;
  unsupportedTopicCount: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  activatedAt: string | null;
  archivedAt: string | null;
  documents: CoursePackDocument[];
};

export type CoursePackSourceEvidence = {
  evidenceId: string;
  documentId: string;
  pageStart: number;
  pageEnd: number;
  evidenceType: string;
  snippet: string;
};

export type CoursePackUnitCandidate = {
  unitCandidateId: string;
  rawTitle: string;
  normalizedTitle: string;
  sequenceOrderCandidate: number;
  importanceTierCandidate: string;
  confidenceScore: number;
  sourceEvidenceIds: string[];
};

export type CoursePackConceptCandidate = {
  conceptCandidateId: string;
  unitCandidateId: string | null;
  rawLabel: string;
  learnerLabelCandidate: string;
  sequenceOrderCandidate: number;
  difficultyTierCandidate: string;
  importanceTierCandidate: string;
  assessmentRelevanceCandidate: string;
  canonicalMappingCandidate: string | null;
  mappingConfidenceScore: number | null;
  coachabilityStatus: string;
  sourceEvidenceIds: string[];
};

export type CoursePackDependencyCandidate = {
  dependencyCandidateId: string;
  fromConceptCandidateId: string;
  toConceptCandidateId: string;
  edgeType: string;
  confidenceScore: number;
  sourceEvidenceIds: string[];
};

export type CoursePackRecurringTheme = {
  themeId: string;
  label: string;
  frequencyScore: number;
  relatedConceptCandidateIds: string[];
  sourceEvidenceIds: string[];
};

export type CoursePackUnsupportedTopic = {
  unsupportedTopicId: string;
  rawLabel: string;
  reasonCode: string;
  sourceEvidenceIds: string[];
  suggestedHandling: string;
};

export type CoursePackGraph = {
  courseGraphId: string;
  version: number;
  averageConfidenceScore: number;
  units: Array<{
    graphUnitId: string;
    sourceUnitCandidateId: string;
    label: string;
    sequenceOrder: number;
    importanceTier: string;
    confidenceScore: number;
    sourceEvidenceIds: string[];
  }>;
  concepts: Array<{
    graphConceptId: string;
    sourceConceptCandidateId: string;
    unitId: string | null;
    label: string;
    normalizedLabel: string;
    sequenceOrder: number;
    difficultyTier: string;
    importanceTier: string;
    assessmentRelevance: string;
    coachabilityStatus: string;
    canonicalTemplateId: string | null;
    mappingConfidenceScore: number | null;
    mergedSourceConceptCandidateIds: string[];
    sourceEvidenceIds: string[];
    confidenceScore: number;
  }>;
  edges: Array<{
    graphEdgeId: string;
    sourceDependencyCandidateId: string;
    fromConceptId: string;
    toConceptId: string;
    edgeType: string;
    confidenceScore: number;
    sourceEvidenceIds: string[];
  }>;
};

export type CoursePackExamBlueprint = {
  examBlueprintId: string;
  averageConfidenceScore: number;
  areas: Array<{
    blueprintAreaId: string;
    label: string;
    unitIds: string[];
    conceptIds: string[];
    priorityTier: string;
    practiceNeed: string;
    recurrenceSignal: string;
    suggestedTimeSharePct: number;
    confidenceScore: number;
    reasonCodes: string[];
    sourceEvidenceIds: string[];
  }>;
};

export type CoursePackSupportLevelAssessment = {
  supportLevelAssessmentId: string;
  parseIntegrityScore: number;
  structureConfidenceScore: number;
  blueprintConfidenceScore: number;
  packCompletenessScore: number;
  coachableCoverageScore: number;
  evaluationReliabilityScore: number;
  candidateSupportLevel: CoursePackSupportLevel;
};

export type CoursePackExtraction = {
  extractionSnapshotId: string;
  coursePackId: string;
  generatedAt: string;
  coverageStatus: string;
  averageConfidenceScore: number;
  documentCount: number;
  lowConfidenceItemCount: number;
  warningCodes: string[];
  units: CoursePackUnitCandidate[];
  concepts: CoursePackConceptCandidate[];
  dependencyCandidates: CoursePackDependencyCandidate[];
  recurringThemes: CoursePackRecurringTheme[];
  sourceEvidence: CoursePackSourceEvidence[];
  unsupportedTopics: CoursePackUnsupportedTopic[];
  courseGraph: CoursePackGraph | null;
  examBlueprint: CoursePackExamBlueprint | null;
  supportLevelAssessment: CoursePackSupportLevelAssessment | null;
};

export type CoursePackConfirmation = {
  confirmationSnapshotId: string;
  coursePackId: string;
  extractionSnapshotId: string;
  supportLevelCandidate: CoursePackSupportLevel;
  status: string;
  editedItemCount: number;
  mergeActionCount: number;
  lowConfidenceAcknowledged: boolean;
  lowConfidenceIncludedCount: number;
  confirmedAt: string;
  activatedAt: string | null;
  baselineExtractionGeneratedAt: string | null;
  baselineBlueprintAreas: Array<{
    blueprintAreaId: string;
    label: string;
    priorityTier: string;
    practiceNeed: string;
    recurrenceSignal: string;
    suggestedTimeSharePct: number;
    confidenceScore: number;
  }>;
  units: Array<{
    confirmedUnitId: string;
    sourceGraphUnitId: string | null;
    sourceUnitCandidateId: string;
    label: string;
    sequenceOrder: number;
    importanceTier: string;
    confidenceScore: number;
    isLowConfidence: boolean;
    sourceEvidenceIds: string[];
  }>;
  concepts: Array<{
    confirmedConceptId: string;
    unitId: string | null;
    sourceGraphConceptId: string | null;
    sourceConceptCandidateId: string;
    label: string;
    normalizedLabel: string;
    sequenceOrder: number;
    difficultyTier: string;
    importanceTier: string;
    assessmentRelevance: string;
    coachabilityStatus: string;
    canonicalTemplateId: string | null;
    engineConceptId: string | null;
    mappingConfidenceScore: number | null;
    confidenceScore: number;
    isLowConfidence: boolean;
    isExamImportant: boolean;
    mergedSourceConceptCandidateIds: string[];
    sourceEvidenceIds: string[];
    referencedBlueprintAreaIds: string[];
  }>;
};

export type CoursePackActivation = {
  coursePackId: string;
  learnerId: string;
  courseTitle: string;
  lifecycleState: CoursePackLifecycleState;
  readinessState: CoursePackReadinessState;
  supportLevelFinal: CoursePackSupportLevel | null;
  isActive: boolean;
  activeConfirmationSnapshotId: string | null;
  activatedAt: string | null;
  confirmationSnapshotId: string;
  confirmationStatus: string;
  compiledCoachPack: {
    compiledCoachPackId: string;
    supportLevel: CoursePackSupportLevel;
    focusNormalizedConceptId: string | null;
    focusEngineConceptId: string | null;
    compilationStatus: string;
    compiledAt: string;
    normalizedConcepts: Array<{
      normalizedConceptId: string;
      sourceConfirmedConceptId: string;
      displayLabel: string;
      normalizedLabel: string;
      sequenceOrder: number;
      coachabilityStatus: string;
      canonicalTemplateId: string | null;
      engineConceptId: string | null;
      priorityTier: string;
      suggestedTimeSharePct: number;
      isExamImportant: boolean;
      sourceEvidenceIds: string[];
    }>;
  };
  activeCourseContext: AdminActiveCourseContext;
};

export type CoursePackConfirmationPayload = {
  confirmedUnitCandidateIds?: string[];
  confirmedConceptCandidateIds?: string[];
  unitEdits?: Array<{
    sourceUnitCandidateId: string;
    label: string;
  }>;
  conceptEdits?: Array<{
    sourceConceptCandidateId: string;
    label: string;
  }>;
  removedItemIds?: string[];
  reorderedUnitIds?: string[];
  mergeActions?: Array<{
    targetSourceConceptCandidateId: string;
    sourceConceptCandidateIds: string[];
  }>;
  examImportantConceptIds?: string[];
  irrelevantItemIds?: string[];
  acknowledgeLowConfidence?: boolean;
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

const RECENT_COURSE_PACK_STORAGE_KEY = "twincoach.coursePackId";

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
  persistOnboardingProfile(input);

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

  const payload = (await response.json()) as DailySessionPayload;
  persistRecentMode(payload.sessionMode);

  return payload;
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

  const payload = (await response.json()) as ProgrammingState;
  persistProgrammingState(payload);

  return payload;
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

  const payload = (await response.json()) as SessionSummary;
  persistSessionSummary(payload);

  return payload;
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

export async function ensureLearnerIdentity(): Promise<string> {
  const learnerId = getLearnerId();

  if (learnerId) {
    return learnerId;
  }

  const bootState = await fetchBootState();
  return bootState.learnerId;
}

export async function createCoursePack(input: {
  courseTitle: string;
  courseCode?: string;
  institutionLabel?: string;
  termLabel?: string;
  primaryLanguage: string;
}): Promise<CoursePackRecord> {
  const learnerId = await ensureLearnerIdentity();
  const response = await fetch(`${getApiBaseUrl()}/course-packs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-learner-id": learnerId,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to create course pack");
  }

  return (await response.json()) as CoursePackRecord;
}

export async function fetchCoursePacks(): Promise<CoursePackRecord[]> {
  const learnerId = await ensureLearnerIdentity();
  const response = await fetch(`${getApiBaseUrl()}/course-packs`, {
    cache: "no-store",
    headers: {
      "x-learner-id": learnerId,
    },
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to load course packs");
  }

  return (await response.json()) as CoursePackRecord[];
}

export async function fetchCoursePack(
  coursePackId: string,
): Promise<CoursePackRecord> {
  const learnerId = await ensureLearnerIdentity();
  const response = await fetch(`${getApiBaseUrl()}/course-packs/${coursePackId}`, {
    cache: "no-store",
    headers: {
      "x-learner-id": learnerId,
    },
  });

  if (!response.ok) {
    throw await createApiError(response, "Failed to load course pack");
  }

  return (await response.json()) as CoursePackRecord;
}

export async function uploadCoursePackDocument(input: {
  coursePackId: string;
  file: File;
  onProgress?: (progress: number) => void;
}): Promise<CoursePackRecord> {
  const learnerId = await ensureLearnerIdentity();

  return new Promise<CoursePackRecord>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getApiBaseUrl()}/course-packs/${input.coursePackId}/documents`);
    xhr.setRequestHeader("x-learner-id", learnerId);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !input.onProgress) {
        return;
      }

      input.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as CoursePackRecord);
          return;
        } catch {
          reject(new ApiError("Failed to parse upload response", xhr.status));
          return;
        }
      }

      try {
        const payload = JSON.parse(xhr.responseText) as {
          message?: string | string[];
        };
        const message = Array.isArray(payload.message)
          ? payload.message.join(", ")
          : payload.message;
        reject(new ApiError(message ?? "Failed to upload course document", xhr.status));
      } catch {
        reject(new ApiError("Failed to upload course document", xhr.status));
      }
    };

    xhr.onerror = () => {
      reject(new ApiError("Failed to upload course document", 0));
    };

    const formData = new FormData();
    formData.append("file", input.file);
    xhr.send(formData);
  });
}

export async function confirmCoursePackDocumentRole(input: {
  coursePackId: string;
  documentId: string;
  confirmedRole: CoursePackDocumentRole;
}): Promise<CoursePackRecord> {
  const learnerId = await ensureLearnerIdentity();
  const response = await fetch(
    `${getApiBaseUrl()}/course-packs/${input.coursePackId}/documents/${input.documentId}/role`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-learner-id": learnerId,
      },
      body: JSON.stringify({
        confirmedRole: input.confirmedRole,
      }),
    },
  );

  if (!response.ok) {
    throw await createApiError(response, "Failed to save document role");
  }

  return (await response.json()) as CoursePackRecord;
}

export async function runCoursePackExtraction(
  coursePackId: string,
): Promise<CoursePackExtraction> {
  const learnerId = await ensureLearnerIdentity();
  const response = await fetch(
    `${getApiBaseUrl()}/course-packs/${coursePackId}/extraction`,
    {
      method: "POST",
      headers: {
        "x-learner-id": learnerId,
      },
    },
  );

  if (!response.ok) {
    throw await createApiError(response, "Failed to run course extraction");
  }

  return (await response.json()) as CoursePackExtraction;
}

export async function fetchLatestCoursePackExtraction(
  coursePackId: string,
): Promise<CoursePackExtraction | null> {
  const learnerId = await ensureLearnerIdentity();
  const response = await fetch(
    `${getApiBaseUrl()}/course-packs/${coursePackId}/extraction`,
    {
      cache: "no-store",
      headers: {
        "x-learner-id": learnerId,
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await createApiError(response, "Failed to load extraction review");
  }

  return (await response.json()) as CoursePackExtraction;
}

export async function createCoursePackConfirmation(input: {
  coursePackId: string;
  payload: CoursePackConfirmationPayload;
}): Promise<CoursePackConfirmation> {
  const learnerId = await ensureLearnerIdentity();
  const response = await fetch(
    `${getApiBaseUrl()}/course-packs/${input.coursePackId}/confirmations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-learner-id": learnerId,
      },
      body: JSON.stringify(input.payload),
    },
  );

  if (!response.ok) {
    throw await createApiError(response, "Failed to save course review");
  }

  return (await response.json()) as CoursePackConfirmation;
}

export async function fetchLatestCoursePackConfirmation(
  coursePackId: string,
): Promise<CoursePackConfirmation | null> {
  const learnerId = await ensureLearnerIdentity();
  const response = await fetch(
    `${getApiBaseUrl()}/course-packs/${coursePackId}/confirmations/latest`,
    {
      cache: "no-store",
      headers: {
        "x-learner-id": learnerId,
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw await createApiError(response, "Failed to load latest review");
  }

  return (await response.json()) as CoursePackConfirmation;
}

export async function activateCoursePack(input: {
  coursePackId: string;
  confirmationSnapshotId?: string;
}): Promise<CoursePackActivation> {
  const learnerId = await ensureLearnerIdentity();
  const response = await fetch(
    `${getApiBaseUrl()}/course-packs/${input.coursePackId}/activate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-learner-id": learnerId,
      },
      body: JSON.stringify({
        confirmationSnapshotId: input.confirmationSnapshotId,
      }),
    },
  );

  if (!response.ok) {
    throw await createApiError(response, "Failed to activate course pack");
  }

  return (await response.json()) as CoursePackActivation;
}

export async function archiveCoursePack(
  coursePackId: string,
): Promise<CoursePackRecord> {
  const learnerId = await ensureLearnerIdentity();
  const response = await fetch(
    `${getApiBaseUrl()}/course-packs/${coursePackId}/archive`,
    {
      method: "POST",
      headers: {
        "x-learner-id": learnerId,
      },
    },
  );

  if (!response.ok) {
    throw await createApiError(response, "Failed to archive course pack");
  }

  return (await response.json()) as CoursePackRecord;
}

export async function replaceCoursePackDocument(input: {
  coursePackId: string;
  documentId: string;
  file: File;
  onProgress?: (progress: number) => void;
}): Promise<CoursePackRecord> {
  const learnerId = await ensureLearnerIdentity();

  return new Promise<CoursePackRecord>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${getApiBaseUrl()}/course-packs/${input.coursePackId}/documents/${input.documentId}/replace`,
    );
    xhr.setRequestHeader("x-learner-id", learnerId);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !input.onProgress) {
        return;
      }

      input.onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) {
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as CoursePackRecord);
          return;
        } catch {
          reject(new ApiError("Failed to parse replace response", xhr.status));
          return;
        }
      }

      try {
        const payload = JSON.parse(xhr.responseText) as {
          message?: string | string[];
        };
        const message = Array.isArray(payload.message)
          ? payload.message.join(", ")
          : payload.message;
        reject(new ApiError(message ?? "Failed to replace course document", xhr.status));
      } catch {
        reject(new ApiError("Failed to replace course document", xhr.status));
      }
    };

    xhr.onerror = () => {
      reject(new ApiError("Failed to replace course document", 0));
    };

    const formData = new FormData();
    formData.append("file", input.file);
    xhr.send(formData);
  });
}

export async function removeCoursePackDocument(input: {
  coursePackId: string;
  documentId: string;
}): Promise<CoursePackRecord> {
  const learnerId = await ensureLearnerIdentity();
  const response = await fetch(
    `${getApiBaseUrl()}/course-packs/${input.coursePackId}/documents/${input.documentId}/remove`,
    {
      method: "POST",
      headers: {
        "x-learner-id": learnerId,
      },
    },
  );

  if (!response.ok) {
    throw await createApiError(response, "Failed to remove course document");
  }

  return (await response.json()) as CoursePackRecord;
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

export function getRecentCoursePackId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(RECENT_COURSE_PACK_STORAGE_KEY) ?? "";
}

export function setRecentCoursePackId(coursePackId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(RECENT_COURSE_PACK_STORAGE_KEY, coursePackId);
}

export function clearRecentCoursePackId() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(RECENT_COURSE_PACK_STORAGE_KEY);
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
