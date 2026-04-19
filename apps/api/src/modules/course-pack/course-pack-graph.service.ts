import { Injectable } from "@nestjs/common";
import {
  EXTRACTION_AUTO_MERGE_SIMILARITY_THRESHOLD,
  EXTRACTION_GRAPH_CONFIDENCE_THRESHOLD,
} from "./course-pack.constants";
import {
  calculateDraftConceptConfidence,
  calculateGraphConceptConfidence,
  computeStringSimilarity,
  roundScore,
} from "./course-pack-extraction.utils";
import {
  DraftCourseGraph,
  DraftExtractedConcept,
  DraftExtractionArtifact,
  DraftGraphConcept,
  DraftGraphEdge,
  DraftGraphUnit,
} from "./course-pack.types";

@Injectable()
export class CoursePackGraphService {
  buildGraph(artifact: DraftExtractionArtifact): DraftCourseGraph {
    const units = this.buildUnits(artifact);
    const concepts = this.buildConcepts(artifact, units);
    const conceptMappings = new Map(
      concepts.flatMap((concept) =>
        concept.mergedSourceConceptTempIds.map((sourceTempId) => [
          sourceTempId,
          concept.sourceConceptTempId,
        ]),
      ),
    );
    const edges = this.buildEdges(artifact, concepts, conceptMappings);
    const averageConfidenceScore = roundScore(
      average([
        ...units.map((unit) => unit.confidenceScore),
        ...concepts.map((concept) => concept.confidenceScore),
        ...edges.map((edge) => edge.confidenceScore),
      ]),
    );

    return {
      averageConfidenceScore,
      units,
      concepts,
      edges,
    };
  }

  private buildUnits(artifact: DraftExtractionArtifact) {
    const eligibleUnits = artifact.units.filter(
      (unit) =>
        unit.confidenceScore >= EXTRACTION_GRAPH_CONFIDENCE_THRESHOLD &&
        unit.sourceEvidenceTempIds.length > 0,
    );
    const mergedUnits: DraftGraphUnit[] = [];

    for (const unit of eligibleUnits.sort(
      (left, right) => left.sequenceOrderCandidate - right.sequenceOrderCandidate,
    )) {
      const duplicate = mergedUnits.find(
        (existing) =>
          computeStringSimilarity(existing.label, unit.rawTitle) >=
          EXTRACTION_AUTO_MERGE_SIMILARITY_THRESHOLD,
      );

      if (duplicate) {
        duplicate.sourceEvidenceIds = [
          ...new Set([...duplicate.sourceEvidenceIds, ...unit.sourceEvidenceTempIds]),
        ];
        duplicate.confidenceScore = roundScore(
          Math.max(duplicate.confidenceScore, unit.confidenceScore),
        );
        duplicate.importanceTier =
          duplicate.importanceTier === "core" ||
          unit.importanceTierCandidate === "core"
            ? "core"
            : duplicate.importanceTier;
        continue;
      }

      mergedUnits.push({
        sourceUnitTempId: unit.tempId,
        label: unit.rawTitle,
        sequenceOrder: unit.sequenceOrderCandidate,
        importanceTier: unit.importanceTierCandidate,
        confidenceScore: unit.confidenceScore,
        sourceEvidenceIds: [...unit.sourceEvidenceTempIds],
      });
    }

    return mergedUnits
      .sort((left, right) => left.sequenceOrder - right.sequenceOrder)
      .map((unit, index) => ({
        ...unit,
        sequenceOrder: index + 1,
      }));
  }

  private buildConcepts(
    artifact: DraftExtractionArtifact,
    units: DraftGraphUnit[],
  ) {
    const unitMappings = new Map(
      units.map((unit) => [unit.sourceUnitTempId, unit.sourceUnitTempId]),
    );
    const eligibleConcepts = artifact.concepts
      .map((concept) => ({
        concept,
        confidenceScore: calculateDraftConceptConfidence(concept),
      }))
      .filter(
        ({ concept, confidenceScore }) =>
          confidenceScore >= EXTRACTION_GRAPH_CONFIDENCE_THRESHOLD &&
          concept.sourceEvidenceTempIds.length > 0,
      )
      .sort(
        (left, right) =>
          left.concept.sequenceOrderCandidate - right.concept.sequenceOrderCandidate,
      );
    const mergedConcepts: DraftGraphConcept[] = [];

    for (const entry of eligibleConcepts) {
      const concept = entry.concept;
      const mergeTarget = mergedConcepts.find((existing) =>
        canMergeConcepts(existing, concept, unitMappings),
      );

      if (mergeTarget) {
        mergeTarget.mergedSourceConceptTempIds = [
          ...new Set([
            ...mergeTarget.mergedSourceConceptTempIds,
            concept.tempId,
          ]),
        ];
        mergeTarget.sourceEvidenceIds = [
          ...new Set([
            ...mergeTarget.sourceEvidenceIds,
            ...concept.sourceEvidenceTempIds,
          ]),
        ];
        mergeTarget.confidenceScore = roundScore(
          Math.max(mergeTarget.confidenceScore, entry.confidenceScore),
        );
        mergeTarget.importanceTier =
          mergeTarget.importanceTier === "core" ||
          concept.importanceTierCandidate === "core"
            ? "core"
            : mergeTarget.importanceTier;
        mergeTarget.assessmentRelevance =
          mergeTarget.assessmentRelevance === "high" ||
          concept.assessmentRelevanceCandidate === "high"
            ? "high"
            : mergeTarget.assessmentRelevance === "medium" ||
                concept.assessmentRelevanceCandidate === "medium"
              ? "medium"
              : mergeTarget.assessmentRelevance;
        mergeTarget.canonicalTemplateId =
          mergeTarget.canonicalTemplateId ?? concept.canonicalMappingCandidate;
        mergeTarget.mappingConfidenceScore = roundScore(
          Math.max(
            mergeTarget.mappingConfidenceScore ?? 0,
            concept.mappingConfidenceScore ?? 0,
          ),
        );
        continue;
      }

      mergedConcepts.push({
        sourceConceptTempId: concept.tempId,
        unitSourceTempId: concept.unitTempId,
        label: concept.learnerLabelCandidate,
        normalizedLabel: concept.normalizedLabel,
        sequenceOrder: concept.sequenceOrderCandidate,
        difficultyTier: concept.difficultyTierCandidate,
        importanceTier: concept.importanceTierCandidate,
        assessmentRelevance: concept.assessmentRelevanceCandidate,
        coachabilityStatus: concept.coachabilityStatus,
        canonicalTemplateId: concept.canonicalMappingCandidate,
        mappingConfidenceScore: concept.mappingConfidenceScore,
        mergedSourceConceptTempIds: [concept.tempId],
        sourceEvidenceIds: [...concept.sourceEvidenceTempIds],
        confidenceScore: entry.confidenceScore,
      });
    }

    return mergedConcepts
      .sort((left, right) => left.sequenceOrder - right.sequenceOrder)
      .map((concept, index) => ({
        ...concept,
        sequenceOrder: index + 1,
        confidenceScore: calculateGraphConceptConfidence(concept),
      }));
  }

  private buildEdges(
    artifact: DraftExtractionArtifact,
    concepts: DraftGraphConcept[],
    conceptMappings: Map<string, string>,
  ) {
    const conceptIds = new Set(concepts.map((concept) => concept.sourceConceptTempId));
    const graphEdges: DraftGraphEdge[] = [];

    for (const dependency of artifact.dependencyCandidates) {
      if (
        dependency.confidenceScore < EXTRACTION_GRAPH_CONFIDENCE_THRESHOLD ||
        dependency.sourceEvidenceTempIds.length === 0
      ) {
        continue;
      }

      const fromConceptSourceTempId =
        conceptMappings.get(dependency.fromConceptTempId) ??
        dependency.fromConceptTempId;
      const toConceptSourceTempId =
        conceptMappings.get(dependency.toConceptTempId) ?? dependency.toConceptTempId;

      if (
        !conceptIds.has(fromConceptSourceTempId) ||
        !conceptIds.has(toConceptSourceTempId) ||
        fromConceptSourceTempId === toConceptSourceTempId
      ) {
        continue;
      }

      const duplicate = graphEdges.find(
        (edge) =>
          edge.fromConceptSourceTempId === fromConceptSourceTempId &&
          edge.toConceptSourceTempId === toConceptSourceTempId &&
          edge.edgeType === dependency.edgeType,
      );

      if (duplicate) {
        duplicate.sourceEvidenceIds = [
          ...new Set([
            ...duplicate.sourceEvidenceIds,
            ...dependency.sourceEvidenceTempIds,
          ]),
        ];
        duplicate.confidenceScore = roundScore(
          Math.max(duplicate.confidenceScore, dependency.confidenceScore),
        );
        continue;
      }

      graphEdges.push({
        sourceDependencyTempId: dependency.tempId,
        fromConceptSourceTempId,
        toConceptSourceTempId,
        edgeType: dependency.edgeType,
        confidenceScore: dependency.confidenceScore,
        sourceEvidenceIds: [...dependency.sourceEvidenceTempIds],
      });
    }

    return graphEdges;
  }
}

function canMergeConcepts(
  existing: DraftGraphConcept,
  incoming: DraftExtractedConcept,
  unitMappings: Map<string, string>,
) {
  const sameUnit =
    (existing.unitSourceTempId ?? null) ===
    (incoming.unitTempId ? unitMappings.get(incoming.unitTempId) ?? incoming.unitTempId : null);

  if (!sameUnit) {
    return false;
  }

  return (
    computeStringSimilarity(existing.normalizedLabel, incoming.normalizedLabel) >=
    EXTRACTION_AUTO_MERGE_SIMILARITY_THRESHOLD
  );
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
