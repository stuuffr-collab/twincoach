import {
  CoursePackSupportLevel,
  SourceDocument,
  SourceDocumentParseStatus,
  SourceDocumentValidationStatus,
} from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { DraftCourseGraph, DraftExamBlueprint, DraftExtractionArtifact, SupportLevelAssessmentSignalSet } from "./course-pack.types";
import { roundScore } from "./course-pack-extraction.utils";

@Injectable()
export class CoursePackSupportLevelService {
  buildCandidateAssessment(input: {
    documents: SourceDocument[];
    artifact: DraftExtractionArtifact;
    graph: DraftCourseGraph;
    blueprint: DraftExamBlueprint;
  }): SupportLevelAssessmentSignalSet {
    const parseableDocuments = input.documents.filter(
      (document) =>
        document.validationStatus === SourceDocumentValidationStatus.valid &&
        (document.parseStatus === SourceDocumentParseStatus.parsed ||
          document.parseStatus === SourceDocumentParseStatus.partial),
    );
    const parseIntegrityScore = roundScore(
      average(
        parseableDocuments.map((document) => document.parseConfidenceScore ?? 0),
      ),
    );
    const structureConfidenceScore = roundScore(
      average([
        input.artifact.averageConfidenceScore,
        input.graph.averageConfidenceScore,
      ]),
    );
    const blueprintConfidenceScore = input.blueprint.averageConfidenceScore;
    const packCompletenessScore = roundScore(
      computePackCompleteness({
        documents: parseableDocuments,
        unitCount: input.artifact.units.length,
        conceptCount: input.artifact.concepts.length,
      }),
    );
    const coachableCoverageScore = roundScore(
      ratio(
        input.graph.concepts.filter(
          (concept) => concept.coachabilityStatus === "coachable",
        ).length,
        input.graph.concepts.length,
      ),
    );
    const evaluationReliabilityScore = roundScore(
      ratio(
        input.graph.concepts.filter((concept) => concept.canonicalTemplateId).length,
        input.graph.concepts.length,
      ),
    );
    const candidateSupportLevel = resolveSupportLevel({
      parseIntegrityScore,
      structureConfidenceScore,
      blueprintConfidenceScore,
      packCompletenessScore,
      coachableCoverageScore,
      evaluationReliabilityScore,
      hasBlockingIssue: input.documents.some((document) =>
        Boolean(document.blockingIssueCode),
      ),
      unitCount: input.graph.units.length,
      conceptCount: input.graph.concepts.length,
      coverageStatus: input.artifact.coverageStatus,
    });

    return {
      parseIntegrityScore,
      structureConfidenceScore,
      blueprintConfidenceScore,
      packCompletenessScore,
      coachableCoverageScore,
      evaluationReliabilityScore,
      candidateSupportLevel,
    };
  }
}

function computePackCompleteness(input: {
  documents: SourceDocument[];
  unitCount: number;
  conceptCount: number;
}) {
  const hasSyllabus = input.documents.some(
    (document) => (document.confirmedRole ?? document.suggestedRole) === "syllabus",
  );
  const hasPastExam = input.documents.some(
    (document) => (document.confirmedRole ?? document.suggestedRole) === "past_exam",
  );
  const instructionalDocumentCount = input.documents.filter((document) =>
    new Set(["syllabus", "lecture_notes", "slides", "lab_sheet", "assignment"]).has(
      document.confirmedRole ?? document.suggestedRole ?? "unknown",
    ),
  ).length;

  return (
    Math.min(0.3, instructionalDocumentCount * 0.1) +
    (hasSyllabus ? 0.2 : 0) +
    (hasPastExam ? 0.2 : 0) +
    Math.min(0.15, input.unitCount * 0.05) +
    Math.min(0.15, input.conceptCount * 0.03)
  );
}

function resolveSupportLevel(input: {
  parseIntegrityScore: number;
  structureConfidenceScore: number;
  blueprintConfidenceScore: number;
  packCompletenessScore: number;
  coachableCoverageScore: number;
  evaluationReliabilityScore: number;
  hasBlockingIssue: boolean;
  unitCount: number;
  conceptCount: number;
  coverageStatus: "complete" | "partial" | "weak";
}) {
  if (
    input.hasBlockingIssue ||
    input.unitCount < 1 ||
    input.conceptCount < 3 ||
    input.coverageStatus === "weak"
  ) {
    return CoursePackSupportLevel.not_ready;
  }

  if (
    input.parseIntegrityScore >= 0.8 &&
    input.structureConfidenceScore >= 0.75 &&
    input.blueprintConfidenceScore >= 0.7 &&
    input.packCompletenessScore >= 0.6 &&
    input.coachableCoverageScore >= 0.65 &&
    input.evaluationReliabilityScore >= 0.8
  ) {
    return CoursePackSupportLevel.full_coach;
  }

  if (
    input.parseIntegrityScore >= 0.7 &&
    input.structureConfidenceScore >= 0.6 &&
    input.blueprintConfidenceScore >= 0.55 &&
    input.packCompletenessScore >= 0.5
  ) {
    return CoursePackSupportLevel.guided_study;
  }

  if (
    input.parseIntegrityScore >= 0.55 &&
    input.structureConfidenceScore >= 0.45
  ) {
    return CoursePackSupportLevel.planning_review;
  }

  return CoursePackSupportLevel.not_ready;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}
