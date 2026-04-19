import {
  ActiveCourseContextPayload,
  CoursePackWithDocuments,
} from "./course-pack.types";

export function mapCoursePackResponse(coursePack: CoursePackWithDocuments) {
  return {
    coursePackId: coursePack.id,
    learnerId: coursePack.learnerId,
    courseTitle: coursePack.courseTitle,
    courseCode: coursePack.courseCode,
    institutionLabel: coursePack.institutionLabel,
    termLabel: coursePack.termLabel,
    primaryLanguage: coursePack.primaryLanguage,
    lifecycleState: coursePack.lifecycleState,
    readinessState: coursePack.readinessState,
    supportLevelCandidate: coursePack.supportLevelCandidate,
    supportLevelFinal: coursePack.supportLevelFinal,
    driftStatus: coursePack.driftStatus,
    driftReasonCodes: coursePack.driftReasonCodes,
    requiresReconfirmation: coursePack.requiresReconfirmation,
    activeContextState: coursePack.activeContextState,
    isActive: coursePack.isActive,
    documentCount: coursePack.documentCount,
    confirmedUnitCount: coursePack.confirmedUnitCount,
    confirmedConceptCount: coursePack.confirmedConceptCount,
    unsupportedTopicCount: coursePack.unsupportedTopicCount,
    createdAt: coursePack.createdAt.toISOString(),
    updatedAt: coursePack.updatedAt.toISOString(),
    confirmedAt: coursePack.confirmedAt?.toISOString() ?? null,
    activatedAt: coursePack.activatedAt?.toISOString() ?? null,
    archivedAt: coursePack.archivedAt?.toISOString() ?? null,
    documents: coursePack.sourceDocuments.map(mapSourceDocumentResponse),
  };
}

export function mapSourceDocumentResponse(document: {
  id: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  pageCount: number | null;
  checksumSha256: string;
  uploadedAt: Date;
  validationStatus: string;
  suggestedRole: string | null;
  confirmedRole: string | null;
  roleConfidenceScore: number | null;
  roleReasonCodes: string[];
  alternateRoleCandidates: unknown;
  parseStatus: string;
  parseConfidenceScore: number | null;
  hasSelectableText: boolean | null;
  textCoverageRatio: number | null;
  warningCodes: string[];
  blockingIssueCode: string | null;
}) {
  return {
    documentId: document.id,
    originalFilename: document.originalFilename,
    mimeType: document.mimeType,
    byteSize: document.byteSize,
    pageCount: document.pageCount,
    checksumSha256: document.checksumSha256,
    uploadedAt: document.uploadedAt.toISOString(),
    validationStatus: document.validationStatus,
    suggestedRole: document.suggestedRole,
    confirmedRole: document.confirmedRole,
    roleConfidenceScore: document.roleConfidenceScore,
    roleReasonCodes: document.roleReasonCodes,
    alternateRoles: Array.isArray(document.alternateRoleCandidates)
      ? document.alternateRoleCandidates
      : [],
    parseStatus: document.parseStatus,
    parseConfidenceScore: document.parseConfidenceScore,
    hasSelectableText: document.hasSelectableText,
    textCoverageRatio: document.textCoverageRatio,
    warningCodes: document.warningCodes,
    blockingIssueCode: document.blockingIssueCode,
  };
}

export function mapCoursePackExtractionResponse(snapshot: {
  id: string;
  coursePackId: string;
  generatedAt: Date;
  coverageStatus: string;
  averageConfidenceScore: number;
  documentCount: number;
  lowConfidenceItemCount: number;
  warningCodes: string[];
  units: Array<{
    id: string;
    rawTitle: string;
    normalizedTitle: string;
    sequenceOrderCandidate: number;
    importanceTierCandidate: string;
    confidenceScore: number;
    sourceEvidenceIds: string[];
  }>;
  concepts: Array<{
    id: string;
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
  }>;
  dependencyCandidates: Array<{
    id: string;
    fromConceptCandidateId: string;
    toConceptCandidateId: string;
    edgeType: string;
    confidenceScore: number;
    sourceEvidenceIds: string[];
  }>;
  recurringThemes: Array<{
    id: string;
    label: string;
    frequencyScore: number;
    relatedConceptCandidateIds: string[];
    sourceEvidenceIds: string[];
  }>;
  sourceEvidences: Array<{
    id: string;
    documentId: string;
    pageStart: number;
    pageEnd: number;
    evidenceType: string;
    snippet: string;
  }>;
  unsupportedTopics: Array<{
    id: string;
    rawLabel: string;
    reasonCode: string;
    sourceEvidenceIds: string[];
    suggestedHandling: string;
  }>;
  courseGraph: {
    id: string;
    version: number;
    averageConfidenceScore: number;
    units: Array<{
      id: string;
      sourceUnitCandidateId: string;
      label: string;
      sequenceOrder: number;
      importanceTier: string;
      confidenceScore: number;
      sourceEvidenceIds: string[];
    }>;
    concepts: Array<{
      id: string;
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
      id: string;
      sourceDependencyCandidateId: string;
      fromConceptId: string;
      toConceptId: string;
      edgeType: string;
      confidenceScore: number;
      sourceEvidenceIds: string[];
    }>;
  } | null;
  examBlueprint: {
    id: string;
    averageConfidenceScore: number;
    areas: Array<{
      id: string;
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
  } | null;
  supportLevelAssessment: {
    id: string;
    parseIntegrityScore: number;
    structureConfidenceScore: number;
    blueprintConfidenceScore: number;
    packCompletenessScore: number;
    coachableCoverageScore: number;
    evaluationReliabilityScore: number;
    candidateSupportLevel: string;
  } | null;
}) {
  return {
    extractionSnapshotId: snapshot.id,
    coursePackId: snapshot.coursePackId,
    generatedAt: snapshot.generatedAt.toISOString(),
    coverageStatus: snapshot.coverageStatus,
    averageConfidenceScore: snapshot.averageConfidenceScore,
    documentCount: snapshot.documentCount,
    lowConfidenceItemCount: snapshot.lowConfidenceItemCount,
    warningCodes: snapshot.warningCodes,
    units: snapshot.units.map((unit) => ({
      unitCandidateId: unit.id,
      rawTitle: unit.rawTitle,
      normalizedTitle: unit.normalizedTitle,
      sequenceOrderCandidate: unit.sequenceOrderCandidate,
      importanceTierCandidate: unit.importanceTierCandidate,
      confidenceScore: unit.confidenceScore,
      sourceEvidenceIds: unit.sourceEvidenceIds,
    })),
    concepts: snapshot.concepts.map((concept) => ({
      conceptCandidateId: concept.id,
      unitCandidateId: concept.unitCandidateId,
      rawLabel: concept.rawLabel,
      learnerLabelCandidate: concept.learnerLabelCandidate,
      sequenceOrderCandidate: concept.sequenceOrderCandidate,
      difficultyTierCandidate: concept.difficultyTierCandidate,
      importanceTierCandidate: concept.importanceTierCandidate,
      assessmentRelevanceCandidate: concept.assessmentRelevanceCandidate,
      canonicalMappingCandidate: concept.canonicalMappingCandidate,
      mappingConfidenceScore: concept.mappingConfidenceScore,
      coachabilityStatus: concept.coachabilityStatus,
      sourceEvidenceIds: concept.sourceEvidenceIds,
    })),
    dependencyCandidates: snapshot.dependencyCandidates.map((dependency) => ({
      dependencyCandidateId: dependency.id,
      fromConceptCandidateId: dependency.fromConceptCandidateId,
      toConceptCandidateId: dependency.toConceptCandidateId,
      edgeType: dependency.edgeType,
      confidenceScore: dependency.confidenceScore,
      sourceEvidenceIds: dependency.sourceEvidenceIds,
    })),
    recurringThemes: snapshot.recurringThemes.map((theme) => ({
      themeId: theme.id,
      label: theme.label,
      frequencyScore: theme.frequencyScore,
      relatedConceptCandidateIds: theme.relatedConceptCandidateIds,
      sourceEvidenceIds: theme.sourceEvidenceIds,
    })),
    sourceEvidence: snapshot.sourceEvidences.map((evidence) => ({
      evidenceId: evidence.id,
      documentId: evidence.documentId,
      pageStart: evidence.pageStart,
      pageEnd: evidence.pageEnd,
      evidenceType: evidence.evidenceType,
      snippet: evidence.snippet,
    })),
    unsupportedTopics: snapshot.unsupportedTopics.map((unsupportedTopic) => ({
      unsupportedTopicId: unsupportedTopic.id,
      rawLabel: unsupportedTopic.rawLabel,
      reasonCode: unsupportedTopic.reasonCode,
      sourceEvidenceIds: unsupportedTopic.sourceEvidenceIds,
      suggestedHandling: unsupportedTopic.suggestedHandling,
    })),
    courseGraph: snapshot.courseGraph
      ? {
          courseGraphId: snapshot.courseGraph.id,
          version: snapshot.courseGraph.version,
          averageConfidenceScore: snapshot.courseGraph.averageConfidenceScore,
          units: snapshot.courseGraph.units.map((unit) => ({
            graphUnitId: unit.id,
            sourceUnitCandidateId: unit.sourceUnitCandidateId,
            label: unit.label,
            sequenceOrder: unit.sequenceOrder,
            importanceTier: unit.importanceTier,
            confidenceScore: unit.confidenceScore,
            sourceEvidenceIds: unit.sourceEvidenceIds,
          })),
          concepts: snapshot.courseGraph.concepts.map((concept) => ({
            graphConceptId: concept.id,
            sourceConceptCandidateId: concept.sourceConceptCandidateId,
            unitId: concept.unitId,
            label: concept.label,
            normalizedLabel: concept.normalizedLabel,
            sequenceOrder: concept.sequenceOrder,
            difficultyTier: concept.difficultyTier,
            importanceTier: concept.importanceTier,
            assessmentRelevance: concept.assessmentRelevance,
            coachabilityStatus: concept.coachabilityStatus,
            canonicalTemplateId: concept.canonicalTemplateId,
            mappingConfidenceScore: concept.mappingConfidenceScore,
            mergedSourceConceptCandidateIds:
              concept.mergedSourceConceptCandidateIds,
            sourceEvidenceIds: concept.sourceEvidenceIds,
            confidenceScore: concept.confidenceScore,
          })),
          edges: snapshot.courseGraph.edges.map((edge) => ({
            graphEdgeId: edge.id,
            sourceDependencyCandidateId: edge.sourceDependencyCandidateId,
            fromConceptId: edge.fromConceptId,
            toConceptId: edge.toConceptId,
            edgeType: edge.edgeType,
            confidenceScore: edge.confidenceScore,
            sourceEvidenceIds: edge.sourceEvidenceIds,
          })),
        }
      : null,
    examBlueprint: snapshot.examBlueprint
      ? {
          examBlueprintId: snapshot.examBlueprint.id,
          averageConfidenceScore: snapshot.examBlueprint.averageConfidenceScore,
          areas: snapshot.examBlueprint.areas.map((area) => ({
            blueprintAreaId: area.id,
            label: area.label,
            unitIds: area.unitIds,
            conceptIds: area.conceptIds,
            priorityTier: area.priorityTier,
            practiceNeed: area.practiceNeed,
            recurrenceSignal: area.recurrenceSignal,
            suggestedTimeSharePct: area.suggestedTimeSharePct,
            confidenceScore: area.confidenceScore,
            reasonCodes: area.reasonCodes,
            sourceEvidenceIds: area.sourceEvidenceIds,
          })),
        }
      : null,
    supportLevelAssessment: snapshot.supportLevelAssessment
      ? {
          supportLevelAssessmentId: snapshot.supportLevelAssessment.id,
          parseIntegrityScore:
            snapshot.supportLevelAssessment.parseIntegrityScore,
          structureConfidenceScore:
            snapshot.supportLevelAssessment.structureConfidenceScore,
          blueprintConfidenceScore:
            snapshot.supportLevelAssessment.blueprintConfidenceScore,
          packCompletenessScore:
            snapshot.supportLevelAssessment.packCompletenessScore,
          coachableCoverageScore:
            snapshot.supportLevelAssessment.coachableCoverageScore,
          evaluationReliabilityScore:
            snapshot.supportLevelAssessment.evaluationReliabilityScore,
          candidateSupportLevel:
            snapshot.supportLevelAssessment.candidateSupportLevel,
        }
      : null,
  };
}

export function mapCoursePackConfirmationResponse(snapshot: {
  id: string;
  coursePackId: string;
  extractionSnapshotId: string;
  supportLevelCandidate: string;
  status: string;
  editedItemCount: number;
  mergeActionCount: number;
  lowConfidenceAcknowledged: boolean;
  lowConfidenceIncludedCount: number;
  confirmedAt: Date;
  activatedAt: Date | null;
  extractionSnapshot?: {
    generatedAt: Date;
    examBlueprint: {
      areas: Array<{
        id: string;
        label: string;
        priorityTier: string;
        practiceNeed: string;
        recurrenceSignal: string;
        suggestedTimeSharePct: number;
        confidenceScore: number;
      }>;
    } | null;
  };
  units: Array<{
    id: string;
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
    id: string;
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
}) {
  return {
    confirmationSnapshotId: snapshot.id,
    coursePackId: snapshot.coursePackId,
    extractionSnapshotId: snapshot.extractionSnapshotId,
    supportLevelCandidate: snapshot.supportLevelCandidate,
    status: snapshot.status,
    editedItemCount: snapshot.editedItemCount,
    mergeActionCount: snapshot.mergeActionCount,
    lowConfidenceAcknowledged: snapshot.lowConfidenceAcknowledged,
    lowConfidenceIncludedCount: snapshot.lowConfidenceIncludedCount,
    confirmedAt: snapshot.confirmedAt.toISOString(),
    activatedAt: snapshot.activatedAt?.toISOString() ?? null,
    baselineExtractionGeneratedAt:
      snapshot.extractionSnapshot?.generatedAt.toISOString() ?? null,
    baselineBlueprintAreas:
      snapshot.extractionSnapshot?.examBlueprint?.areas.map((area) => ({
        blueprintAreaId: area.id,
        label: area.label,
        priorityTier: area.priorityTier,
        practiceNeed: area.practiceNeed,
        recurrenceSignal: area.recurrenceSignal,
        suggestedTimeSharePct: area.suggestedTimeSharePct,
        confidenceScore: area.confidenceScore,
      })) ?? [],
    units: snapshot.units.map((unit) => ({
      confirmedUnitId: unit.id,
      sourceGraphUnitId: unit.sourceGraphUnitId,
      sourceUnitCandidateId: unit.sourceUnitCandidateId,
      label: unit.label,
      sequenceOrder: unit.sequenceOrder,
      importanceTier: unit.importanceTier,
      confidenceScore: unit.confidenceScore,
      isLowConfidence: unit.isLowConfidence,
      sourceEvidenceIds: unit.sourceEvidenceIds,
    })),
    concepts: snapshot.concepts.map((concept) => ({
      confirmedConceptId: concept.id,
      unitId: concept.unitId,
      sourceGraphConceptId: concept.sourceGraphConceptId,
      sourceConceptCandidateId: concept.sourceConceptCandidateId,
      label: concept.label,
      normalizedLabel: concept.normalizedLabel,
      sequenceOrder: concept.sequenceOrder,
      difficultyTier: concept.difficultyTier,
      importanceTier: concept.importanceTier,
      assessmentRelevance: concept.assessmentRelevance,
      coachabilityStatus: concept.coachabilityStatus,
      canonicalTemplateId: concept.canonicalTemplateId,
      engineConceptId: concept.engineConceptId,
      mappingConfidenceScore: concept.mappingConfidenceScore,
      confidenceScore: concept.confidenceScore,
      isLowConfidence: concept.isLowConfidence,
      isExamImportant: concept.isExamImportant,
      mergedSourceConceptCandidateIds: concept.mergedSourceConceptCandidateIds,
      sourceEvidenceIds: concept.sourceEvidenceIds,
      referencedBlueprintAreaIds: concept.referencedBlueprintAreaIds,
    })),
  };
}

export function mapActiveCourseContextResponse(context: {
  coursePackId: string;
  courseTitle: string;
  supportLevel: string;
  focusCompiledConceptId: string | null;
  focusEngineConceptId: string | null;
  activatedAt: Date;
  focusCompiledConcept?: {
    displayLabel: string;
  } | null;
  refreshContext?: ActiveCourseContextPayload["refreshContext"];
  followThrough?: ActiveCourseContextPayload["followThrough"];
  resolution?: ActiveCourseContextPayload["resolution"];
}): ActiveCourseContextPayload {
  return {
    coursePackId: context.coursePackId,
    courseTitle: context.courseTitle,
    supportLevel: context.supportLevel as ActiveCourseContextPayload["supportLevel"],
    focusNormalizedConceptId: context.focusCompiledConceptId,
    focusNormalizedConceptLabel: context.focusCompiledConcept?.displayLabel ?? null,
    focusEngineConceptId: context.focusEngineConceptId,
    activatedAt: context.activatedAt.toISOString(),
    refreshContext: context.refreshContext ?? null,
    followThrough: context.followThrough ?? null,
    resolution: context.resolution ?? null,
  };
}

export function mapCoursePackActivationResponse(input: {
  coursePack: {
    id: string;
    learnerId: string;
    courseTitle: string;
    lifecycleState: string;
    readinessState: string;
    supportLevelFinal: string | null;
    isActive: boolean;
    activeConfirmationSnapshotId: string | null;
    confirmedUnitCount?: number;
    confirmedConceptCount?: number;
    activatedAt?: Date | null;
  };
  confirmationSnapshot: {
    id: string;
    supportLevelCandidate: string;
    status: string;
    activatedAt: Date | null;
  };
  compiledCoachPack: {
    id: string;
    supportLevel: string;
    focusCompiledConceptId: string | null;
    focusEngineConceptId: string | null;
    compilationStatus: string;
    compiledAt: Date;
    concepts: Array<{
      id: string;
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
  activeCourseContext: {
    learnerId: string;
    coursePackId: string;
    courseTitle: string;
    supportLevel: string;
    focusCompiledConceptId: string | null;
    focusEngineConceptId: string | null;
    activatedAt: Date;
    focusCompiledConcept?: {
      displayLabel: string;
    } | null;
  };
}) {
  return {
    coursePackId: input.coursePack.id,
    learnerId: input.coursePack.learnerId,
    courseTitle: input.coursePack.courseTitle,
    lifecycleState: input.coursePack.lifecycleState,
    readinessState: input.coursePack.readinessState,
    supportLevelFinal: input.coursePack.supportLevelFinal,
    isActive: input.coursePack.isActive,
    activeConfirmationSnapshotId: input.coursePack.activeConfirmationSnapshotId,
    activatedAt: input.coursePack.activatedAt?.toISOString() ?? null,
    confirmationSnapshotId: input.confirmationSnapshot.id,
    confirmationStatus: input.confirmationSnapshot.status,
    compiledCoachPack: {
      compiledCoachPackId: input.compiledCoachPack.id,
      supportLevel: input.compiledCoachPack.supportLevel,
      focusNormalizedConceptId: input.compiledCoachPack.focusCompiledConceptId,
      focusEngineConceptId: input.compiledCoachPack.focusEngineConceptId,
      compilationStatus: input.compiledCoachPack.compilationStatus,
      compiledAt: input.compiledCoachPack.compiledAt.toISOString(),
      normalizedConcepts: input.compiledCoachPack.concepts.map((concept) => ({
        normalizedConceptId: concept.id,
        sourceConfirmedConceptId: concept.sourceConfirmedConceptId,
        displayLabel: concept.displayLabel,
        normalizedLabel: concept.normalizedLabel,
        sequenceOrder: concept.sequenceOrder,
        coachabilityStatus: concept.coachabilityStatus,
        canonicalTemplateId: concept.canonicalTemplateId,
        engineConceptId: concept.engineConceptId,
        priorityTier: concept.priorityTier,
        suggestedTimeSharePct: concept.suggestedTimeSharePct,
        isExamImportant: concept.isExamImportant,
        sourceEvidenceIds: concept.sourceEvidenceIds,
      })),
    },
    activeCourseContext: mapActiveCourseContextResponse(input.activeCourseContext),
  };
}
