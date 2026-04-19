import {
  DraftExtractedConcept,
  DraftGraphConcept,
} from "./course-pack.types";
import {
  ExtractionAssessmentRelevanceTier,
  ExtractionDifficultyTier,
  ExtractionImportanceTier,
} from "@prisma/client";

export function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateDraftConceptConfidence(
  concept: Pick<
    DraftExtractedConcept,
    | "importanceTierCandidate"
    | "assessmentRelevanceCandidate"
    | "difficultyTierCandidate"
    | "canonicalMappingCandidate"
  >,
) {
  let score = 0.5;

  if (concept.importanceTierCandidate === ExtractionImportanceTier.supporting) {
    score += 0.08;
  }

  if (concept.importanceTierCandidate === ExtractionImportanceTier.core) {
    score += 0.12;
  }

  if (
    concept.assessmentRelevanceCandidate === ExtractionAssessmentRelevanceTier.medium
  ) {
    score += 0.05;
  }

  if (
    concept.assessmentRelevanceCandidate === ExtractionAssessmentRelevanceTier.high
  ) {
    score += 0.12;
  }

  if (
    concept.difficultyTierCandidate === ExtractionDifficultyTier.medium ||
    concept.difficultyTierCandidate === ExtractionDifficultyTier.high
  ) {
    score += 0.03;
  }

  if (concept.canonicalMappingCandidate) {
    score += 0.18;
  }

  return roundScore(Math.min(0.95, score));
}

export function calculateGraphConceptConfidence(
  concept: Pick<
    DraftGraphConcept,
    | "importanceTier"
    | "assessmentRelevance"
    | "difficultyTier"
    | "canonicalTemplateId"
  >,
) {
  return calculateDraftConceptConfidence({
    importanceTierCandidate: concept.importanceTier,
    assessmentRelevanceCandidate: concept.assessmentRelevance,
    difficultyTierCandidate: concept.difficultyTier,
    canonicalMappingCandidate: concept.canonicalTemplateId,
  });
}

export function computeStringSimilarity(left: string, right: string) {
  const normalizedLeft = normalizeSimilarityValue(left);
  const normalizedRight = normalizeSimilarityValue(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  if (
    normalizedLeft.startsWith(normalizedRight) ||
    normalizedRight.startsWith(normalizedLeft)
  ) {
    return 0.92;
  }

  const leftTokens = new Set(normalizedLeft.split(/\s+/).filter(Boolean));
  const rightTokens = new Set(normalizedRight.split(/\s+/).filter(Boolean));
  const union = new Set([...leftTokens, ...rightTokens]);

  if (union.size === 0) {
    return 0;
  }

  let intersectionCount = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersectionCount += 1;
    }
  }

  return roundScore(intersectionCount / union.size);
}

function normalizeSimilarityValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
