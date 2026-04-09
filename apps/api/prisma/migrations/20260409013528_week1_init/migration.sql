-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('multiple_choice', 'numeric_input', 'expression_choice');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('correct', 'needs_review', 'try_fix', 'needs_another_check');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('generated', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "LearnerProgressState" AS ENUM ('new', 'onboarding_complete', 'diagnostic_in_progress', 'today_available');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('diagnostic', 'daily');

-- CreateTable
CREATE TABLE "Learner" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Learner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamCycle" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "activeUnitId" TEXT NOT NULL,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "progressState" "LearnerProgressState" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "examWeight" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrerequisiteLink" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "prerequisiteTopicId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,

    CONSTRAINT "PrerequisiteLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionItem" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "questionType" "QuestionType" NOT NULL,
    "stem" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "inputMode" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "estimatedTimeSec" INTEGER NOT NULL,
    "supportedFeedbackType" "FeedbackType" NOT NULL,
    "supportedErrorTags" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "QuestionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "examCycleId" TEXT NOT NULL,
    "sessionType" "SessionType" NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'generated',
    "currentIndex" INTEGER NOT NULL DEFAULT 1,
    "totalItems" INTEGER NOT NULL,
    "checkpointToken" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionItemId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "slotType" TEXT NOT NULL,
    "isFollowup" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SessionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sessionItemId" TEXT NOT NULL,
    "questionItemId" TEXT NOT NULL,
    "answerOutcome" TEXT NOT NULL,
    "attemptIndex" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerTopicState" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "masteryState" TEXT NOT NULL,
    "prereqRiskState" TEXT NOT NULL,
    "validEvidenceCount" INTEGER NOT NULL DEFAULT 0,
    "lastEvidenceAt" TIMESTAMP(3),
    "nextReviewDueAt" TIMESTAMP(3),

    CONSTRAINT "LearnerTopicState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamCycle_learnerId_idx" ON "ExamCycle"("learnerId");

-- CreateIndex
CREATE INDEX "PrerequisiteLink_topicId_idx" ON "PrerequisiteLink"("topicId");

-- CreateIndex
CREATE INDEX "PrerequisiteLink_prerequisiteTopicId_idx" ON "PrerequisiteLink"("prerequisiteTopicId");

-- CreateIndex
CREATE INDEX "QuestionItem_topicId_idx" ON "QuestionItem"("topicId");

-- CreateIndex
CREATE INDEX "Session_learnerId_idx" ON "Session"("learnerId");

-- CreateIndex
CREATE INDEX "Session_examCycleId_idx" ON "Session"("examCycleId");

-- CreateIndex
CREATE INDEX "SessionItem_sessionId_idx" ON "SessionItem"("sessionId");

-- CreateIndex
CREATE INDEX "Attempt_learnerId_idx" ON "Attempt"("learnerId");

-- CreateIndex
CREATE INDEX "Attempt_sessionId_idx" ON "Attempt"("sessionId");

-- CreateIndex
CREATE INDEX "Attempt_sessionItemId_idx" ON "Attempt"("sessionItemId");

-- CreateIndex
CREATE INDEX "LearnerTopicState_topicId_idx" ON "LearnerTopicState"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerTopicState_learnerId_topicId_key" ON "LearnerTopicState"("learnerId", "topicId");

-- AddForeignKey
ALTER TABLE "ExamCycle" ADD CONSTRAINT "ExamCycle_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionItem" ADD CONSTRAINT "QuestionItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItem" ADD CONSTRAINT "SessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionItem" ADD CONSTRAINT "SessionItem_questionItemId_fkey" FOREIGN KEY ("questionItemId") REFERENCES "QuestionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_sessionItemId_fkey" FOREIGN KEY ("sessionItemId") REFERENCES "SessionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_questionItemId_fkey" FOREIGN KEY ("questionItemId") REFERENCES "QuestionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerTopicState" ADD CONSTRAINT "LearnerTopicState_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerTopicState" ADD CONSTRAINT "LearnerTopicState_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
