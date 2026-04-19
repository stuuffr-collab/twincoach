import { SourceDocumentRole } from "@prisma/client";

export const COURSE_PACK_MAX_FILES = 15;
export const COURSE_PACK_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const COURSE_PACK_MAX_PAGE_COUNT = 300;
export const COURSE_PACK_MIN_TEXT_CHARACTERS = 24;
export const COURSE_PACK_LOW_TEXT_COVERAGE_THRESHOLD = 0.2;
export const COURSE_PACK_BLOCKED_TEXT_COVERAGE_THRESHOLD = 0.05;
export const COURSE_PACK_TEXT_PREVIEW_LENGTH = 2_000;
export const PDF_MIME_TYPE = "application/pdf";

export const INSTRUCTIONAL_DOCUMENT_ROLES = new Set<SourceDocumentRole>([
  SourceDocumentRole.syllabus,
  SourceDocumentRole.lecture_notes,
  SourceDocumentRole.slides,
  SourceDocumentRole.lab_sheet,
  SourceDocumentRole.assignment,
]);

export const SOURCE_DOCUMENT_ROLE_VALUES = Object.values(SourceDocumentRole);

export const EXTRACTION_GRAPH_CONFIDENCE_THRESHOLD = 0.55;
export const EXTRACTION_AUTO_MERGE_SIMILARITY_THRESHOLD = 0.9;
export const EXTRACTION_RECURRING_THEME_THRESHOLD = 2;

export const COURSE_PACK_STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "all",
  "also",
  "and",
  "are",
  "assessment",
  "assignment",
  "before",
  "between",
  "chapter",
  "class",
  "course",
  "coverage",
  "during",
  "each",
  "exam",
  "final",
  "from",
  "grading",
  "important",
  "includes",
  "into",
  "lecture",
  "learning",
  "material",
  "midterm",
  "module",
  "notes",
  "objectives",
  "overview",
  "past",
  "project",
  "quiz",
  "reference",
  "review",
  "session",
  "slides",
  "study",
  "syllabus",
  "term",
  "that",
  "their",
  "these",
  "this",
  "topic",
  "unit",
  "week",
  "with",
]);
