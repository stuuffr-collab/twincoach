import { Prisma } from "@prisma/client";

export const COURSE_PACK_EXTRACTION_INCLUDE =
  Prisma.validator<Prisma.ExtractionSnapshotInclude>()({
    units: true,
    concepts: true,
    dependencyCandidates: true,
    recurringThemes: true,
    sourceEvidences: true,
    unsupportedTopics: true,
    courseGraph: {
      include: {
        units: true,
        concepts: true,
        edges: true,
      },
    },
    examBlueprint: {
      include: {
        areas: true,
      },
    },
    supportLevelAssessment: true,
    confirmationSnapshots: {
      include: {
        units: true,
        concepts: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    },
  });

export const COURSE_PACK_CONFIRMATION_INCLUDE =
  Prisma.validator<Prisma.ConfirmationSnapshotInclude>()({
    units: true,
    concepts: true,
    extractionSnapshot: {
      include: COURSE_PACK_EXTRACTION_INCLUDE,
    },
    compiledCoachPack: {
      include: {
        concepts: true,
      },
    },
  });

export const ACTIVE_COURSE_CONTEXT_INCLUDE =
  Prisma.validator<Prisma.ActiveCourseContextInclude>()({
    coursePack: true,
    focusCompiledConcept: true,
    compiledCoachPack: {
      include: {
        concepts: true,
      },
    },
  });

export type CoursePackExtractionSnapshotWithRelations =
  Prisma.ExtractionSnapshotGetPayload<{
    include: typeof COURSE_PACK_EXTRACTION_INCLUDE;
  }>;

export type ConfirmationSnapshotWithRelations =
  Prisma.ConfirmationSnapshotGetPayload<{
    include: typeof COURSE_PACK_CONFIRMATION_INCLUDE;
  }>;

export type ActiveCourseContextWithRelations =
  Prisma.ActiveCourseContextGetPayload<{
    include: typeof ACTIVE_COURSE_CONTEXT_INCLUDE;
  }>;
