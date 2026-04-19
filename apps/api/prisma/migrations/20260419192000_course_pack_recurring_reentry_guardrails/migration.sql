-- AlterTable
ALTER TABLE "ActiveCourseContext" ADD COLUMN     "recurringResolvedAt" TIMESTAMP(3),
ADD COLUMN     "recurringResolvedConceptId" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "recurringDecisionType" TEXT,
ADD COLUMN     "recurringSourceConceptId" TEXT,
ADD COLUMN     "recurringSourceConceptLabel" TEXT;
