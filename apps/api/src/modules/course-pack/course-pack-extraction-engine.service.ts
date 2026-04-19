import {
  CoursePackCoachabilityStatus,
  CoursePackDependencyEdgeType,
  ExtractionAssessmentRelevanceTier,
  ExtractionCoverageStatus,
  ExtractionDifficultyTier,
  ExtractionImportanceTier,
  UnsupportedTopicHandling,
} from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { COURSE_PACK_STOPWORDS } from "./course-pack.constants";
import {
  calculateDraftConceptConfidence,
  roundScore,
} from "./course-pack-extraction.utils";
import {
  DraftExtractionArtifact,
  DraftExtractedConcept,
  DraftExtractedDependency,
  DraftExtractedUnit,
  DraftRecurringTheme,
  DraftSourceEvidence,
  DraftUnsupportedTopic,
  ParsedDocumentText,
} from "./course-pack.types";

const UNIT_HEADING_PATTERN =
  /^(unit|chapter|module|week|lecture|topic)\s*(\d+)?\s*[:\-]\s*(.+)$/i;
const EXPLICIT_CONCEPTS_PATTERN =
  /^(concepts?|topics?|focus|key topics?|coverage|includes?)\s*[:\-]\s*(.+)$/i;
const BULLET_PATTERN = /^[-*\u2022]\s+(.+)$/;
const DEPENDENCY_PATTERN =
  /(before|after|prerequisite|depends on|requires|builds on)/i;
const EXAM_SIGNAL_PATTERN = /(exam|midterm|final|quiz|assessment|marks?)/i;
const HIGH_DIFFICULTY_PATTERN = /(advanced|complex|challenging|proof|derive)/i;
const ADMIN_NOISE_PATTERN =
  /(office hours|attendance|grading breakdown|submission policy|contact|bibliography|reference list|reading list)/i;

const CANONICAL_TEMPLATE_MATCHERS = [
  {
    canonicalTemplateId: "programming_v1:variables",
    patterns: [/variables?/i, /expressions?/i, /input ?output/i],
  },
  {
    canonicalTemplateId: "programming_v1:conditionals",
    patterns: [/conditionals?/i, /\bif\b/i, /branching/i],
  },
  {
    canonicalTemplateId: "programming_v1:loops",
    patterns: [/loops?/i, /iteration/i, /while loop/i, /for loop/i],
  },
  {
    canonicalTemplateId: "programming_v1:functions",
    patterns: [/functions?/i, /parameters?/i, /return values?/i],
  },
  {
    canonicalTemplateId: "programming_v1:tracing",
    patterns: [/tracing/i, /state tracing/i, /dry run/i],
  },
  {
    canonicalTemplateId: "programming_v1:debugging",
    patterns: [/debugging/i, /errors?/i, /bug spotting/i],
  },
];

@Injectable()
export class CoursePackExtractionEngineService {
  createArtifact(documents: ParsedDocumentText[]): DraftExtractionArtifact {
    const tempIds = createTempIdFactory();
    const sourceEvidences: DraftSourceEvidence[] = [];
    const units: DraftExtractedUnit[] = [];
    const concepts: DraftExtractedConcept[] = [];
    const dependencyCandidates: DraftExtractedDependency[] = [];
    const recurringThemes: DraftRecurringTheme[] = [];
    const unsupportedTopics: DraftUnsupportedTopic[] = [];
    const warnings = buildWarningCodes(documents);
    const dependencyClues: Array<{
      line: string;
      evidenceTempId: string;
    }> = [];

    for (const document of documents) {
      const lineEntries = buildLineEntries(document);
      let currentUnitTempId: string | null = null;
      let hasExplicitUnit = false;
      const documentConcepts: DraftExtractedConcept[] = [];

      for (const lineEntry of lineEntries) {
        const normalizedLine = lineEntry.text;

        if (!normalizedLine) {
          continue;
        }

        if (ADMIN_NOISE_PATTERN.test(normalizedLine)) {
          const evidenceTempId = pushSourceEvidence({
            tempIds,
            sourceEvidences,
            documentId: document.documentId,
            pageNumber: lineEntry.pageNumber,
            evidenceType: "non_instructional_line",
            snippet: normalizedLine,
          });

          unsupportedTopics.push({
            tempId: tempIds("unsupported"),
            rawLabel: truncateText(normalizedLine, 120),
            reasonCode: "non_instructional_content",
            sourceEvidenceTempIds: [evidenceTempId],
            suggestedHandling: UnsupportedTopicHandling.unsupported,
          });
          continue;
        }

        const unitMatch = normalizedLine.match(UNIT_HEADING_PATTERN);

        if (unitMatch) {
          hasExplicitUnit = true;
          const unitTitle = normalizeTitle(unitMatch[3] ?? normalizedLine);
          const evidenceTempId = pushSourceEvidence({
            tempIds,
            sourceEvidences,
            documentId: document.documentId,
            pageNumber: lineEntry.pageNumber,
            evidenceType: "unit_heading",
            snippet: normalizedLine,
          });
          currentUnitTempId = tempIds("unit");

          units.push({
            tempId: currentUnitTempId,
            rawTitle: unitTitle,
            normalizedTitle: normalizeLabel(unitTitle),
            sequenceOrderCandidate: units.length + 1,
            importanceTierCandidate: inferImportanceTier(
              document.confirmedRole,
              true,
            ),
            confidenceScore: 0.88,
            sourceEvidenceTempIds: [evidenceTempId],
          });
          continue;
        }

        const explicitConceptLabels = extractExplicitConceptLabels(normalizedLine);

        if (explicitConceptLabels.length > 0) {
          currentUnitTempId =
            currentUnitTempId ??
            ensureFallbackUnit({
              document,
              firstLine: normalizedLine,
              tempIds,
              sourceEvidences,
              units,
            });

          for (const label of explicitConceptLabels) {
            const concept = buildConceptCandidate({
              label,
              unitTempId: currentUnitTempId,
              sequenceOrder: concepts.length + documentConcepts.length + 1,
              document,
              lineText: normalizedLine,
              pageNumber: lineEntry.pageNumber,
              tempIds,
              sourceEvidences,
            });
            documentConcepts.push(concept);
          }
          continue;
        }

        const bulletMatch = normalizedLine.match(BULLET_PATTERN);

        if (bulletMatch) {
          currentUnitTempId =
            currentUnitTempId ??
            ensureFallbackUnit({
              document,
              firstLine: normalizedLine,
              tempIds,
              sourceEvidences,
              units,
            });

          const label = normalizeTitle(bulletMatch[1]);
          const concept = buildConceptCandidate({
            label,
            unitTempId: currentUnitTempId,
            sequenceOrder: concepts.length + documentConcepts.length + 1,
            document,
            lineText: normalizedLine,
            pageNumber: lineEntry.pageNumber,
            tempIds,
            sourceEvidences,
          });
          documentConcepts.push(concept);
          continue;
        }

        if (DEPENDENCY_PATTERN.test(normalizedLine)) {
          const evidenceTempId = pushSourceEvidence({
            tempIds,
            sourceEvidences,
            documentId: document.documentId,
            pageNumber: lineEntry.pageNumber,
            evidenceType: "dependency_signal",
            snippet: normalizedLine,
          });

          dependencyClues.push({
            line: normalizedLine,
            evidenceTempId,
          });
        }
      }

      if (!hasExplicitUnit) {
        currentUnitTempId = ensureFallbackUnit({
          document,
          firstLine: lineEntries[0]?.text ?? document.originalFilename,
          tempIds,
          sourceEvidences,
          units,
        });
      }

      if (documentConcepts.length === 0) {
        const fallbackKeywords = extractFallbackKeywords(lineEntries);

        for (const keyword of fallbackKeywords) {
          const evidenceTempId = pushSourceEvidence({
            tempIds,
            sourceEvidences,
            documentId: document.documentId,
            pageNumber: keyword.pageNumber,
            evidenceType: "fallback_keyword",
            snippet: keyword.snippet,
          });
          const canonicalMapping = mapCanonicalTemplate(keyword.label);

          documentConcepts.push({
            tempId: tempIds("concept"),
            unitTempId: currentUnitTempId,
            rawLabel: keyword.label,
            learnerLabelCandidate: keyword.label,
            normalizedLabel: normalizeLabel(keyword.label),
            sequenceOrderCandidate: concepts.length + documentConcepts.length + 1,
            difficultyTierCandidate: ExtractionDifficultyTier.unknown,
            importanceTierCandidate: inferImportanceTier(
              document.confirmedRole,
              false,
            ),
            assessmentRelevanceCandidate: inferAssessmentRelevance(
              document.confirmedRole,
              keyword.snippet,
            ),
            canonicalMappingCandidate: canonicalMapping.canonicalTemplateId,
            mappingConfidenceScore: canonicalMapping.mappingConfidenceScore,
            coachabilityStatus: canonicalMapping.coachabilityStatus,
            sourceEvidenceTempIds: [evidenceTempId],
          });
        }
      }

      concepts.push(...documentConcepts);
    }

    dependencyCandidates.push(
      ...buildDependencyCandidates({
        concepts,
        dependencyClues,
        tempIds,
      }),
    );

    recurringThemes.push(
      ...buildRecurringThemes({
        concepts,
        tempIds,
      }),
    );

    const averageConfidenceScore = calculateAverageConfidence([
      ...units.map((item) => item.confidenceScore),
      ...concepts.map((item) => conceptConfidence(item)),
      ...dependencyCandidates.map((item) => item.confidenceScore),
      ...recurringThemes.map((item) => item.frequencyScore),
    ]);
    const lowConfidenceItemCount =
      units.filter((item) => item.confidenceScore < 0.55).length +
      concepts.filter((item) => conceptConfidence(item) < 0.55).length +
      dependencyCandidates.filter((item) => item.confidenceScore < 0.55).length;
    const coverageStatus = inferCoverageStatus({
      documents,
      concepts,
      averageConfidenceScore,
      lowConfidenceItemCount,
      warnings,
    });

    return {
      coverageStatus,
      averageConfidenceScore,
      lowConfidenceItemCount,
      warningCodes: warnings,
      sourceEvidences,
      units,
      concepts,
      dependencyCandidates,
      recurringThemes,
      unsupportedTopics,
    };
  }
}

function buildLineEntries(document: ParsedDocumentText) {
  return document.pages.flatMap((page) =>
    page.text
      .split(/\r?\n+/)
      .map((line) => normalizeTextLine(line))
      .filter((line) => line.length > 0)
      .map((text) => ({
        pageNumber: page.pageNumber,
        text,
      })),
  );
}

function buildWarningCodes(documents: ParsedDocumentText[]) {
  const warnings: string[] = [];
  const confirmedRoles = new Set(
    documents.map((document) => document.confirmedRole),
  );

  if (!confirmedRoles.has("past_exam")) {
    warnings.push("sparse_assessment_signals");
  }

  if (!confirmedRoles.has("syllabus")) {
    warnings.push("missing_syllabus_signal");
  }

  return warnings;
}

function pushSourceEvidence(input: {
  tempIds: ReturnType<typeof createTempIdFactory>;
  sourceEvidences: DraftSourceEvidence[];
  documentId: string;
  pageNumber: number;
  evidenceType: string;
  snippet: string;
}) {
  const evidenceTempId = input.tempIds("evidence");

  input.sourceEvidences.push({
    tempId: evidenceTempId,
    documentId: input.documentId,
    pageStart: input.pageNumber,
    pageEnd: input.pageNumber,
    evidenceType: input.evidenceType,
    snippet: truncateText(input.snippet, 400),
  });

  return evidenceTempId;
}

function ensureFallbackUnit(input: {
  document: ParsedDocumentText;
  firstLine: string;
  tempIds: ReturnType<typeof createTempIdFactory>;
  sourceEvidences: DraftSourceEvidence[];
  units: DraftExtractedUnit[];
}) {
  const fallbackTitle = buildFallbackUnitTitle(input.document);
  const existing = input.units.find((unit) => unit.rawTitle === fallbackTitle);

  if (existing) {
    return existing.tempId;
  }

  const evidenceTempId = pushSourceEvidence({
    tempIds: input.tempIds,
    sourceEvidences: input.sourceEvidences,
    documentId: input.document.documentId,
    pageNumber: 1,
    evidenceType: "fallback_unit",
    snippet: input.firstLine,
  });
  const unitTempId = input.tempIds("unit");

  input.units.push({
    tempId: unitTempId,
    rawTitle: fallbackTitle,
    normalizedTitle: normalizeLabel(fallbackTitle),
    sequenceOrderCandidate: input.units.length + 1,
    importanceTierCandidate: inferImportanceTier(
      input.document.confirmedRole,
      false,
    ),
    confidenceScore: 0.6,
    sourceEvidenceTempIds: [evidenceTempId],
  });

  return unitTempId;
}

function buildConceptCandidate(input: {
  label: string;
  unitTempId: string | null;
  sequenceOrder: number;
  document: ParsedDocumentText;
  lineText: string;
  pageNumber: number;
  tempIds: ReturnType<typeof createTempIdFactory>;
  sourceEvidences: DraftSourceEvidence[];
}): DraftExtractedConcept {
  const evidenceTempId = pushSourceEvidence({
    tempIds: input.tempIds,
    sourceEvidences: input.sourceEvidences,
    documentId: input.document.documentId,
    pageNumber: input.pageNumber,
    evidenceType: "concept_signal",
    snippet: input.lineText,
  });
  const canonicalMapping = mapCanonicalTemplate(input.label);

  return {
    tempId: input.tempIds("concept"),
    unitTempId: input.unitTempId,
    rawLabel: input.label,
    learnerLabelCandidate: input.label,
    normalizedLabel: normalizeLabel(input.label),
    sequenceOrderCandidate: input.sequenceOrder,
    difficultyTierCandidate: inferDifficultyTier(input.lineText),
    importanceTierCandidate: inferImportanceTier(input.document.confirmedRole, true),
    assessmentRelevanceCandidate: inferAssessmentRelevance(
      input.document.confirmedRole,
      input.lineText,
    ),
    canonicalMappingCandidate: canonicalMapping.canonicalTemplateId,
    mappingConfidenceScore: canonicalMapping.mappingConfidenceScore,
    coachabilityStatus: canonicalMapping.coachabilityStatus,
    sourceEvidenceTempIds: [evidenceTempId],
  };
}

function buildDependencyCandidates(input: {
  concepts: DraftExtractedConcept[];
  dependencyClues: Array<{
    line: string;
    evidenceTempId: string;
  }>;
  tempIds: ReturnType<typeof createTempIdFactory>;
}) {
  const dependencyCandidates: DraftExtractedDependency[] = [];

  for (const clue of input.dependencyClues) {
    const matchedConcepts = input.concepts.filter((concept) =>
      clue.line.toLowerCase().includes(concept.normalizedLabel),
    );

    if (matchedConcepts.length < 2) {
      continue;
    }

    const [first, second] = matchedConcepts
      .sort(
        (left, right) =>
          left.sequenceOrderCandidate - right.sequenceOrderCandidate,
      )
      .slice(0, 2);
    const useForwardOrder =
      /before|prerequisite|requires|builds on/i.test(clue.line);

    dependencyCandidates.push({
      tempId: input.tempIds("dependency"),
      fromConceptTempId: useForwardOrder ? first.tempId : second.tempId,
      toConceptTempId: useForwardOrder ? second.tempId : first.tempId,
      edgeType: CoursePackDependencyEdgeType.prerequisite,
      confidenceScore: 0.78,
      sourceEvidenceTempIds: [clue.evidenceTempId],
    });
  }

  return dependencyCandidates;
}

function buildRecurringThemes(input: {
  concepts: DraftExtractedConcept[];
  tempIds: ReturnType<typeof createTempIdFactory>;
}) {
  const groupedConcepts = new Map<string, DraftExtractedConcept[]>();

  for (const concept of input.concepts) {
    const existing = groupedConcepts.get(concept.normalizedLabel) ?? [];
    existing.push(concept);
    groupedConcepts.set(concept.normalizedLabel, existing);
  }

  const recurringThemes: DraftRecurringTheme[] = [];

  for (const relatedConcepts of groupedConcepts.values()) {
    if (relatedConcepts.length < 2) {
      continue;
    }

    recurringThemes.push({
      tempId: input.tempIds("theme"),
      label: relatedConcepts[0].learnerLabelCandidate,
      frequencyScore: roundScore(Math.min(1, relatedConcepts.length / 3)),
      relatedConceptTempIds: relatedConcepts.map((concept) => concept.tempId),
      sourceEvidenceTempIds: [
        ...new Set(
          relatedConcepts.flatMap((concept) => concept.sourceEvidenceTempIds),
        ),
      ],
    });
  }

  return recurringThemes;
}

function extractExplicitConceptLabels(line: string) {
  const explicitMatch = line.match(EXPLICIT_CONCEPTS_PATTERN);

  if (explicitMatch) {
    return splitConceptLabels(explicitMatch[2]);
  }

  return [];
}

function splitConceptLabels(value: string) {
  return value
    .split(/[;,/]/)
    .map((label) => normalizeTitle(label))
    .filter((label) => label.length >= 3)
    .slice(0, 8);
}

function extractFallbackKeywords(
  lineEntries: Array<{
    pageNumber: number;
    text: string;
  }>,
) {
  const counts = new Map<
    string,
    {
      count: number;
      pageNumber: number;
      snippet: string;
    }
  >();

  for (const lineEntry of lineEntries) {
    for (const token of tokenize(lineEntry.text)) {
      const current = counts.get(token);

      if (current) {
        current.count += 1;
        continue;
      }

      counts.set(token, {
        count: 1,
        pageNumber: lineEntry.pageNumber,
        snippet: lineEntry.text,
      });
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 3)
    .map(([label, metadata]) => ({
      label: titleCase(label),
      pageNumber: metadata.pageNumber,
      snippet: metadata.snippet,
    }));
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 5)
    .filter((token) => !COURSE_PACK_STOPWORDS.has(token));
}

function mapCanonicalTemplate(label: string) {
  for (const matcher of CANONICAL_TEMPLATE_MATCHERS) {
    if (matcher.patterns.some((pattern) => pattern.test(label))) {
      return {
        canonicalTemplateId: matcher.canonicalTemplateId,
        mappingConfidenceScore: 0.9,
        coachabilityStatus: CoursePackCoachabilityStatus.coachable,
      };
    }
  }

  return {
    canonicalTemplateId: null,
    mappingConfidenceScore: null,
    coachabilityStatus: CoursePackCoachabilityStatus.partially_supported,
  };
}

function inferImportanceTier(role: string, hasExplicitSignal: boolean) {
  if (role === "syllabus" || role === "past_exam") {
    return ExtractionImportanceTier.core;
  }

  if (hasExplicitSignal || role === "lecture_notes" || role === "slides") {
    return ExtractionImportanceTier.supporting;
  }

  return ExtractionImportanceTier.peripheral;
}

function inferAssessmentRelevance(role: string, line: string) {
  if (role === "past_exam") {
    return ExtractionAssessmentRelevanceTier.high;
  }

  if (EXAM_SIGNAL_PATTERN.test(line)) {
    return ExtractionAssessmentRelevanceTier.high;
  }

  if (role === "syllabus" || role === "assignment" || role === "lab_sheet") {
    return ExtractionAssessmentRelevanceTier.medium;
  }

  return ExtractionAssessmentRelevanceTier.low;
}

function inferDifficultyTier(line: string) {
  if (HIGH_DIFFICULTY_PATTERN.test(line)) {
    return ExtractionDifficultyTier.high;
  }

  if (/practice|exercise|problem/i.test(line)) {
    return ExtractionDifficultyTier.medium;
  }

  return ExtractionDifficultyTier.unknown;
}

function inferCoverageStatus(input: {
  documents: ParsedDocumentText[];
  concepts: DraftExtractedConcept[];
  averageConfidenceScore: number;
  lowConfidenceItemCount: number;
  warnings: string[];
}) {
  if (input.concepts.length < 3 || input.averageConfidenceScore < 0.45) {
    return ExtractionCoverageStatus.weak;
  }

  if (
    input.lowConfidenceItemCount > 0 ||
    input.warnings.length > 0 ||
    input.documents.some((document) => document.parseConfidenceScore < 0.7)
  ) {
    return ExtractionCoverageStatus.partial;
  }

  return ExtractionCoverageStatus.complete;
}

function calculateAverageConfidence(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return roundScore(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function conceptConfidence(concept: DraftExtractedConcept) {
  return calculateDraftConceptConfidence(concept);
}

function buildFallbackUnitTitle(document: ParsedDocumentText) {
  const filenameWithoutExtension = document.originalFilename.replace(/\.pdf$/i, "");
  const normalizedFilename = filenameWithoutExtension
    .replace(/[-_]+/g, " ")
    .trim();

  return normalizeTitle(normalizedFilename || `${document.confirmedRole} pack`);
}

function normalizeTextLine(value: string) {
  return value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
}

function normalizeLabel(value: string) {
  return normalizeTextLine(value).toLowerCase();
}

function normalizeTitle(value: string) {
  return titleCase(normalizeTextLine(value));
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function truncateText(value: string, maxLength: number) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3)}...`;
}

function createTempIdFactory() {
  let counter = 0;

  return (prefix: string) => {
    counter += 1;
    return `${prefix}_${counter}`;
  };
}
