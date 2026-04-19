-- AlterTable
ALTER TABLE "ActiveCourseContext" ADD COLUMN     "refreshFollowThroughConceptId" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "refreshSequence" INTEGER;
