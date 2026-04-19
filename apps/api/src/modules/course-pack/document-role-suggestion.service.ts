import { Injectable } from "@nestjs/common";
import { SourceDocumentRole } from "@prisma/client";
import { RoleSuggestion } from "./course-pack.types";

type RoleSignalConfig = {
  role: SourceDocumentRole;
  filenamePatterns: RegExp[];
  textPatterns: RegExp[];
};

const ROLE_SIGNAL_CONFIGS: RoleSignalConfig[] = [
  {
    role: SourceDocumentRole.syllabus,
    filenamePatterns: [/syllabus/i, /course[-_\s]?outline/i],
    textPatterns: [/grading/i, /office hours/i, /learning objectives/i, /assessment/i],
  },
  {
    role: SourceDocumentRole.lecture_notes,
    filenamePatterns: [/lecture/i, /notes?/i, /week[-_\s]?\d+/i, /chapter/i],
    textPatterns: [/worked example/i, /concept review/i, /learning objective/i],
  },
  {
    role: SourceDocumentRole.slides,
    filenamePatterns: [/slides?/i, /deck/i, /presentation/i],
    textPatterns: [/agenda/i, /overview/i, /key takeaways/i],
  },
  {
    role: SourceDocumentRole.past_exam,
    filenamePatterns: [/exam/i, /midterm/i, /final/i, /quiz/i],
    textPatterns: [/time allowed/i, /answer all questions/i, /marks/i],
  },
  {
    role: SourceDocumentRole.lab_sheet,
    filenamePatterns: [/lab/i, /practical/i, /worksheet/i],
    textPatterns: [/equipment/i, /procedure/i, /lab objective/i],
  },
  {
    role: SourceDocumentRole.assignment,
    filenamePatterns: [/assignment/i, /homework/i, /problem[-_\s]?set/i, /project/i],
    textPatterns: [/submission/i, /due date/i, /instructions/i],
  },
  {
    role: SourceDocumentRole.reference,
    filenamePatterns: [/reference/i, /reading/i, /textbook/i, /appendix/i],
    textPatterns: [/further reading/i, /reference material/i, /bibliography/i],
  },
];

@Injectable()
export class DocumentRoleSuggestionService {
  suggestRole(input: {
    originalFilename: string;
    textPreview: string | null;
  }): RoleSuggestion {
    const scoredRoles = ROLE_SIGNAL_CONFIGS.map((config) =>
      this.scoreRole(config, input),
    ).sort((left, right) => right.confidenceScore - left.confidenceScore);

    const primary = scoredRoles[0];
    const secondary = scoredRoles[1];

    if (!primary || primary.confidenceScore < 0.3) {
      return {
        suggestedRole: SourceDocumentRole.unknown,
        confidenceScore: 0,
        reasonCodes: ["insufficient_role_signals"],
        alternateRoles: [],
      };
    }

    const reasonCodes = [...primary.reasonCodes];

    if (
      secondary &&
      primary.confidenceScore - secondary.confidenceScore <= 0.1
    ) {
      reasonCodes.push("role_conflict");
    }

    return {
      suggestedRole: primary.role,
      confidenceScore: primary.confidenceScore,
      reasonCodes,
      alternateRoles: scoredRoles
        .filter((candidate) => candidate.role !== primary.role)
        .filter((candidate) => candidate.confidenceScore >= 0.2)
        .slice(0, 3)
        .map((candidate) => ({
          role: candidate.role,
          confidenceScore: candidate.confidenceScore,
        })),
    };
  }

  private scoreRole(
    config: RoleSignalConfig,
    input: {
      originalFilename: string;
      textPreview: string | null;
    },
  ) {
    let score = 0;
    const reasonCodes: string[] = [];

    for (const pattern of config.filenamePatterns) {
      if (!pattern.test(input.originalFilename)) {
        continue;
      }

      score += 0.22;
      reasonCodes.push(`filename_match_${slugifyPattern(pattern)}`);
    }

    const textPreview = input.textPreview ?? "";

    for (const pattern of config.textPatterns) {
      if (!pattern.test(textPreview)) {
        continue;
      }

      score += 0.14;
      reasonCodes.push(`text_match_${slugifyPattern(pattern)}`);
    }

    return {
      role: config.role,
      confidenceScore: roundScore(Math.max(0, Math.min(1, score))),
      reasonCodes,
    };
  }
}

function slugifyPattern(pattern: RegExp) {
  return pattern.source.replaceAll(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}
