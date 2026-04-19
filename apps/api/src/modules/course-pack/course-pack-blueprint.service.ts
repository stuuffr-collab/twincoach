import { Injectable } from "@nestjs/common";
import { DraftCourseGraph, DraftExamBlueprint, DraftExtractionArtifact } from "./course-pack.types";
import { roundScore } from "./course-pack-extraction.utils";

@Injectable()
export class CoursePackBlueprintService {
  buildBlueprint(
    artifact: DraftExtractionArtifact,
    graph: DraftCourseGraph,
  ): DraftExamBlueprint {
    const areas = graph.units.map((unit) => {
      const concepts = graph.concepts.filter(
        (concept) => concept.unitSourceTempId === unit.sourceUnitTempId,
      );
      const relevantThemes = artifact.recurringThemes.filter((theme) =>
        theme.relatedConceptTempIds.some((conceptTempId) =>
          concepts.some((concept) =>
            concept.mergedSourceConceptTempIds.includes(conceptTempId),
          ),
        ),
      );
      const recurrenceSignal = inferRecurrenceSignal(
        concepts.length,
        relevantThemes.length,
      );
      const priorityTier = inferPriorityTier(unit.importanceTier, concepts);
      const practiceNeed = inferPracticeNeed(priorityTier, concepts, recurrenceSignal);
      const sourceEvidenceIds = [
        ...new Set([
          ...unit.sourceEvidenceIds,
          ...concepts.flatMap((concept) => concept.sourceEvidenceIds),
          ...relevantThemes.flatMap((theme) => theme.sourceEvidenceTempIds),
        ]),
      ];
      const confidenceScore = roundScore(
        average([
          unit.confidenceScore,
          ...concepts.map((concept) => concept.confidenceScore),
          ...relevantThemes.map((theme) => theme.frequencyScore),
        ]),
      );

      return {
        label: unit.label,
        unitSourceTempIds: [unit.sourceUnitTempId],
        conceptSourceTempIds: concepts.map((concept) => concept.sourceConceptTempId),
        priorityTier,
        practiceNeed,
        recurrenceSignal,
        suggestedTimeSharePct: 0,
        confidenceScore,
        reasonCodes: buildReasonCodes(priorityTier, practiceNeed, recurrenceSignal),
        sourceEvidenceIds,
      };
    });
    const weightedAreas = normalizeTimeShare(areas);
    const averageConfidenceScore = roundScore(
      average(weightedAreas.map((area) => area.confidenceScore)),
    );

    return {
      averageConfidenceScore,
      areas: weightedAreas,
    };
  }
}

function inferPriorityTier(
  importanceTier: DraftCourseGraph["units"][number]["importanceTier"],
  concepts: DraftCourseGraph["concepts"],
) {
  if (
    importanceTier === "core" ||
    concepts.some((concept) => concept.assessmentRelevance === "high")
  ) {
    return "high" as const;
  }

  if (
    importanceTier === "supporting" ||
    concepts.some((concept) => concept.assessmentRelevance === "medium")
  ) {
    return "medium" as const;
  }

  return "low" as const;
}

function inferPracticeNeed(
  priorityTier: "high" | "medium" | "low",
  concepts: DraftCourseGraph["concepts"],
  recurrenceSignal: "strong" | "moderate" | "weak" | "none",
) {
  if (
    priorityTier === "high" &&
    (concepts.some((concept) => concept.difficultyTier === "high") ||
      recurrenceSignal === "strong")
  ) {
    return "high" as const;
  }

  if (
    priorityTier !== "low" ||
    concepts.some((concept) => concept.difficultyTier === "medium") ||
    recurrenceSignal === "moderate"
  ) {
    return "medium" as const;
  }

  return "low" as const;
}

function inferRecurrenceSignal(
  conceptCount: number,
  themeCount: number,
) {
  if (themeCount >= 2) {
    return "strong" as const;
  }

  if (themeCount === 1) {
    return "moderate" as const;
  }

  if (conceptCount >= 2) {
    return "weak" as const;
  }

  return "none" as const;
}

function buildReasonCodes(
  priorityTier: "high" | "medium" | "low",
  practiceNeed: "high" | "medium" | "low",
  recurrenceSignal: "strong" | "moderate" | "weak" | "none",
) {
  const reasonCodes = [`priority_${priorityTier}`];

  if (practiceNeed !== "low") {
    reasonCodes.push(`practice_${practiceNeed}`);
  }

  if (recurrenceSignal !== "none") {
    reasonCodes.push(`recurrence_${recurrenceSignal}`);
  }

  return reasonCodes;
}

function normalizeTimeShare<
  T extends {
    priorityTier: "high" | "medium" | "low";
    practiceNeed: "high" | "medium" | "low";
    recurrenceSignal: "strong" | "moderate" | "weak" | "none";
    suggestedTimeSharePct: number;
  },
>(areas: T[]) {
  if (areas.length === 0) {
    return areas;
  }

  const weighted = areas.map((area) => ({
    area,
    weight:
      priorityWeight(area.priorityTier) +
      practiceWeight(area.practiceNeed) +
      recurrenceWeight(area.recurrenceSignal),
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  let assigned = 0;

  const normalized = weighted.map((item, index) => {
    if (index === weighted.length - 1) {
      return {
        ...item.area,
        suggestedTimeSharePct: Math.max(0, 100 - assigned),
      };
    }

    const suggestedTimeSharePct = Math.max(
      5,
      Math.round((item.weight / totalWeight) * 100),
    );
    assigned += suggestedTimeSharePct;

    return {
      ...item.area,
      suggestedTimeSharePct,
    };
  });
  const overflow = normalized.reduce(
    (sum, area) => sum + area.suggestedTimeSharePct,
    0,
  );

  if (overflow !== 100 && normalized.length > 0) {
    normalized[normalized.length - 1] = {
      ...normalized[normalized.length - 1],
      suggestedTimeSharePct:
        normalized[normalized.length - 1].suggestedTimeSharePct + (100 - overflow),
    };
  }

  return normalized;
}

function priorityWeight(priorityTier: "high" | "medium" | "low") {
  if (priorityTier === "high") {
    return 5;
  }

  if (priorityTier === "medium") {
    return 3;
  }

  return 1;
}

function practiceWeight(practiceNeed: "high" | "medium" | "low") {
  if (practiceNeed === "high") {
    return 3;
  }

  if (practiceNeed === "medium") {
    return 2;
  }

  return 1;
}

function recurrenceWeight(
  recurrenceSignal: "strong" | "moderate" | "weak" | "none",
) {
  if (recurrenceSignal === "strong") {
    return 3;
  }

  if (recurrenceSignal === "moderate") {
    return 2;
  }

  if (recurrenceSignal === "weak") {
    return 1;
  }

  return 0;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
