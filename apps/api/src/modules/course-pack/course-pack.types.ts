import {
  CoursePack,
  CoursePackCoachabilityStatus,
  CoursePackDependencyEdgeType,
  CoursePackLifecycleState,
  CoursePackReadinessState,
  CoursePackSupportLevel,
  ExamBlueprintPracticeNeedTier,
  ExamBlueprintPriorityTier,
  ExamBlueprintRecurrenceSignal,
  ExtractionAssessmentRelevanceTier,
  ExtractionCoverageStatus,
  ExtractionDifficultyTier,
  ExtractionImportanceTier,
  Prisma,
  SourceDocument,
  SourceDocumentParseStatus,
  SourceDocumentRole,
  SourceDocumentValidationStatus,
  UnsupportedTopicHandling,
} from "@prisma/client";

export type UploadedPdfFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

export type AlternateRoleCandidate = {
  role: SourceDocumentRole;
  confidenceScore: number;
};

export type RoleSuggestion = {
  suggestedRole: SourceDocumentRole;
  confidenceScore: number;
  reasonCodes: string[];
  alternateRoles: AlternateRoleCandidate[];
};

export type DocumentValidationResult = {
  validationStatus: SourceDocumentValidationStatus;
  parseStatus: SourceDocumentParseStatus;
  parseConfidenceScore: number | null;
  pageCount: number | null;
  hasSelectableText: boolean;
  textCoverageRatio: number;
  textPreview: string | null;
  warningCodes: string[];
  blockingIssueCode: string | null;
};

export type CoursePackWithDocuments = CoursePack & {
  sourceDocuments: SourceDocument[];
};

export type CoursePackStateSnapshot = {
  lifecycleState: CoursePackLifecycleState;
  readinessState: CoursePackReadinessState;
  documentCount: number;
};

export type AlternateRoleCandidatesJson =
  Prisma.JsonArray | Prisma.JsonObject | Prisma.JsonValue;

export type ParsedDocumentPage = {
  pageNumber: number;
  text: string;
};

export type ParsedDocumentText = {
  documentId: string;
  confirmedRole: SourceDocumentRole;
  originalFilename: string;
  pageCount: number;
  parseConfidenceScore: number;
  pages: ParsedDocumentPage[];
};

export type DraftSourceEvidence = {
  tempId: string;
  documentId: string;
  pageStart: number;
  pageEnd: number;
  evidenceType: string;
  snippet: string;
};

export type DraftExtractedUnit = {
  tempId: string;
  rawTitle: string;
  normalizedTitle: string;
  sequenceOrderCandidate: number;
  importanceTierCandidate: ExtractionImportanceTier;
  confidenceScore: number;
  sourceEvidenceTempIds: string[];
};

export type DraftExtractedConcept = {
  tempId: string;
  unitTempId: string | null;
  rawLabel: string;
  learnerLabelCandidate: string;
  normalizedLabel: string;
  sequenceOrderCandidate: number;
  difficultyTierCandidate: ExtractionDifficultyTier;
  importanceTierCandidate: ExtractionImportanceTier;
  assessmentRelevanceCandidate: ExtractionAssessmentRelevanceTier;
  canonicalMappingCandidate: string | null;
  mappingConfidenceScore: number | null;
  coachabilityStatus: CoursePackCoachabilityStatus;
  sourceEvidenceTempIds: string[];
};

export type DraftExtractedDependency = {
  tempId: string;
  fromConceptTempId: string;
  toConceptTempId: string;
  edgeType: CoursePackDependencyEdgeType;
  confidenceScore: number;
  sourceEvidenceTempIds: string[];
};

export type DraftRecurringTheme = {
  tempId: string;
  label: string;
  frequencyScore: number;
  relatedConceptTempIds: string[];
  sourceEvidenceTempIds: string[];
};

export type DraftUnsupportedTopic = {
  tempId: string;
  rawLabel: string;
  reasonCode: string;
  sourceEvidenceTempIds: string[];
  suggestedHandling: UnsupportedTopicHandling;
};

export type DraftExtractionArtifact = {
  coverageStatus: ExtractionCoverageStatus;
  averageConfidenceScore: number;
  lowConfidenceItemCount: number;
  warningCodes: string[];
  sourceEvidences: DraftSourceEvidence[];
  units: DraftExtractedUnit[];
  concepts: DraftExtractedConcept[];
  dependencyCandidates: DraftExtractedDependency[];
  recurringThemes: DraftRecurringTheme[];
  unsupportedTopics: DraftUnsupportedTopic[];
};

export type DraftGraphUnit = {
  sourceUnitTempId: string;
  label: string;
  sequenceOrder: number;
  importanceTier: ExtractionImportanceTier;
  confidenceScore: number;
  sourceEvidenceIds: string[];
};

export type DraftGraphConcept = {
  sourceConceptTempId: string;
  unitSourceTempId: string | null;
  label: string;
  normalizedLabel: string;
  sequenceOrder: number;
  difficultyTier: ExtractionDifficultyTier;
  importanceTier: ExtractionImportanceTier;
  assessmentRelevance: ExtractionAssessmentRelevanceTier;
  coachabilityStatus: CoursePackCoachabilityStatus;
  canonicalTemplateId: string | null;
  mappingConfidenceScore: number | null;
  mergedSourceConceptTempIds: string[];
  sourceEvidenceIds: string[];
  confidenceScore: number;
};

export type DraftGraphEdge = {
  sourceDependencyTempId: string;
  fromConceptSourceTempId: string;
  toConceptSourceTempId: string;
  edgeType: CoursePackDependencyEdgeType;
  confidenceScore: number;
  sourceEvidenceIds: string[];
};

export type DraftCourseGraph = {
  averageConfidenceScore: number;
  units: DraftGraphUnit[];
  concepts: DraftGraphConcept[];
  edges: DraftGraphEdge[];
};

export type DraftBlueprintArea = {
  label: string;
  unitSourceTempIds: string[];
  conceptSourceTempIds: string[];
  priorityTier: ExamBlueprintPriorityTier;
  practiceNeed: ExamBlueprintPracticeNeedTier;
  recurrenceSignal: ExamBlueprintRecurrenceSignal;
  suggestedTimeSharePct: number;
  confidenceScore: number;
  reasonCodes: string[];
  sourceEvidenceIds: string[];
};

export type DraftExamBlueprint = {
  averageConfidenceScore: number;
  areas: DraftBlueprintArea[];
};

export type SupportLevelAssessmentSignalSet = {
  parseIntegrityScore: number;
  structureConfidenceScore: number;
  blueprintConfidenceScore: number;
  packCompletenessScore: number;
  coachableCoverageScore: number;
  evaluationReliabilityScore: number;
  candidateSupportLevel: CoursePackSupportLevel;
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

export type ActiveCourseContextPayload = {
  coursePackId: string;
  courseTitle: string;
  supportLevel: CoursePackSupportLevel;
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
    previousSupportLevel: CoursePackSupportLevel | null;
    currentSupportLevel: CoursePackSupportLevel;
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

export type PackProgressMemoryPayload = {
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

export type RecurringFocusDecisionPayload = {
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

export type ResolvedRecurringFocusPayload = {
  normalizedConceptId: string;
  label: string;
  resolvedAt: string;
};

export type SessionRefreshHandoffPayload = {
  reasonType:
    | "changed_concept"
    | "changed_blueprint_priority"
    | "support_level_impact"
    | "new_material";
  sourceLabel: string | null;
  previousSupportLevel: CoursePackSupportLevel | null;
  currentSupportLevel: CoursePackSupportLevel;
  isFirstSessionAfterRefresh: boolean;
  isFollowThroughSession: boolean;
  isResolutionSession: boolean;
} | null;
