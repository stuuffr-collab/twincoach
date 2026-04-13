-- CreateEnum
CREATE TYPE "ProgrammingExposure" AS ENUM ('none', 'school_basics', 'self_taught_basics', 'completed_intro_course');

-- CreateEnum
CREATE TYPE "ComfortLevel" AS ENUM ('very_low', 'low', 'medium');

-- CreateEnum
CREATE TYPE "ProgrammingDifficultyArea" AS ENUM ('reading_code', 'writing_syntax', 'tracing_logic', 'debugging_errors');

-- CreateEnum
CREATE TYPE "HelpKind" AS ENUM ('step_breakdown', 'worked_example', 'debugging_hint', 'concept_explanation');

-- CreateEnum
CREATE TYPE "ProgrammingTaskType" AS ENUM ('output_prediction', 'trace_reasoning', 'bug_spotting', 'code_completion', 'concept_choice');

-- CreateEnum
CREATE TYPE "AnswerFormat" AS ENUM ('single_choice', 'short_text');

-- CreateEnum
CREATE TYPE "ProgrammingTaskSetRole" AS ENUM ('diagnostic', 'practice');

-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('steady_practice', 'concept_repair', 'debugging_drill', 'recovery_mode');

-- CreateEnum
CREATE TYPE "MomentumState" AS ENUM ('unknown', 'low', 'steady', 'strong');

-- CreateEnum
CREATE TYPE "StabilityState" AS ENUM ('unknown', 'fragile', 'developing', 'steady');

-- CreateEnum
CREATE TYPE "ResilienceState" AS ENUM ('unknown', 'fragile', 'recovering', 'steady');

-- CreateEnum
CREATE TYPE "MasteryState" AS ENUM ('unknown', 'emerging', 'steady');

-- CreateEnum
CREATE TYPE "ProgrammingErrorTag" AS ENUM ('syntax_form_error', 'value_tracking_error', 'branch_logic_error', 'loop_control_error', 'function_usage_error', 'debugging_strategy_error');

-- CreateEnum
CREATE TYPE "SummaryTemplateField" AS ENUM ('whatImproved', 'whatNeedsSupport', 'studyPatternObserved', 'nextBestAction');

-- AlterEnum
ALTER TYPE "SessionType" ADD VALUE 'daily_practice';

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "answerValue" TEXT,
ADD COLUMN     "helpKindUsed" "HelpKind",
ADD COLUMN     "isCorrect" BOOLEAN,
ADD COLUMN     "primaryErrorTag" "ProgrammingErrorTag",
ADD COLUMN     "timeToFirstActionMs" INTEGER,
ADD COLUMN     "timeToSubmitMs" INTEGER;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "focusConceptId" TEXT,
ADD COLUMN     "rationaleCode" TEXT,
ADD COLUMN     "sessionMode" "SessionMode";

-- CreateTable
CREATE TABLE "ProgrammingProfile" (
    "learnerId" TEXT NOT NULL,
    "priorProgrammingExposure" "ProgrammingExposure" NOT NULL,
    "currentComfortLevel" "ComfortLevel" NOT NULL,
    "biggestDifficulty" "ProgrammingDifficultyArea" NOT NULL,
    "preferredHelpStyle" "HelpKind" NOT NULL,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammingProfile_pkey" PRIMARY KEY ("learnerId")
);

-- CreateTable
CREATE TABLE "ProgrammingConcept" (
    "id" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "learnerLabel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammingConcept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammingHintTemplate" (
    "id" TEXT NOT NULL,
    "helpKind" "HelpKind" NOT NULL,
    "label" TEXT NOT NULL,
    "templateText" TEXT NOT NULL,
    "allowedTaskTypes" JSONB NOT NULL,
    "allowedModes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammingHintTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammingFeedbackTemplate" (
    "id" TEXT NOT NULL,
    "feedbackType" "FeedbackType" NOT NULL,
    "templateText" TEXT NOT NULL,
    "allowedTaskTypes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammingFeedbackTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammingSummaryTemplate" (
    "id" TEXT NOT NULL,
    "summaryField" "SummaryTemplateField" NOT NULL,
    "triggerCode" TEXT NOT NULL,
    "templateText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammingSummaryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammingTask" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "taskSetRole" "ProgrammingTaskSetRole" NOT NULL,
    "taskType" "ProgrammingTaskType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "codeSnippet" TEXT,
    "choices" JSONB NOT NULL,
    "answerFormat" "AnswerFormat" NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "helperText" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "estimatedTimeSec" INTEGER NOT NULL,
    "supportedErrorTags" JSONB NOT NULL,
    "modeTags" JSONB,
    "hintTemplateId" TEXT,
    "feedbackTemplateId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearnerProgrammingPersona" (
    "learnerId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "preferredHelpStyle" "HelpKind" NOT NULL,
    "sessionMomentumState" "MomentumState" NOT NULL DEFAULT 'unknown',
    "syntaxStabilityState" "StabilityState" NOT NULL DEFAULT 'unknown',
    "logicTracingState" "StabilityState" NOT NULL DEFAULT 'unknown',
    "debuggingResilienceState" "ResilienceState" NOT NULL DEFAULT 'unknown',
    "focusConceptId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerProgrammingPersona_pkey" PRIMARY KEY ("learnerId")
);

-- CreateTable
CREATE TABLE "LearnerProgrammingConceptState" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "masteryState" "MasteryState" NOT NULL DEFAULT 'unknown',
    "recentErrorTag" "ProgrammingErrorTag",
    "lastObservedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerProgrammingConceptState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelemetryEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "learnerId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "sessionId" TEXT,
    "sessionItemId" TEXT,
    "properties" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelemetryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgrammingTask_conceptId_idx" ON "ProgrammingTask"("conceptId");

-- CreateIndex
CREATE INDEX "ProgrammingTask_taskSetRole_idx" ON "ProgrammingTask"("taskSetRole");

-- CreateIndex
CREATE INDEX "ProgrammingTask_hintTemplateId_idx" ON "ProgrammingTask"("hintTemplateId");

-- CreateIndex
CREATE INDEX "ProgrammingTask_feedbackTemplateId_idx" ON "ProgrammingTask"("feedbackTemplateId");

-- CreateIndex
CREATE INDEX "LearnerProgrammingPersona_focusConceptId_idx" ON "LearnerProgrammingPersona"("focusConceptId");

-- CreateIndex
CREATE INDEX "LearnerProgrammingConceptState_conceptId_idx" ON "LearnerProgrammingConceptState"("conceptId");

-- CreateIndex
CREATE INDEX "LearnerProgrammingConceptState_recentErrorTag_idx" ON "LearnerProgrammingConceptState"("recentErrorTag");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerProgrammingConceptState_learnerId_conceptId_key" ON "LearnerProgrammingConceptState"("learnerId", "conceptId");

-- CreateIndex
CREATE INDEX "TelemetryEvent_learnerId_idx" ON "TelemetryEvent"("learnerId");

-- CreateIndex
CREATE INDEX "TelemetryEvent_eventName_idx" ON "TelemetryEvent"("eventName");

-- CreateIndex
CREATE INDEX "TelemetryEvent_occurredAt_idx" ON "TelemetryEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "TelemetryEvent_sessionId_idx" ON "TelemetryEvent"("sessionId");

-- CreateIndex
CREATE INDEX "Attempt_primaryErrorTag_idx" ON "Attempt"("primaryErrorTag");

-- CreateIndex
CREATE INDEX "Session_focusConceptId_idx" ON "Session"("focusConceptId");

-- AddForeignKey
ALTER TABLE "ProgrammingProfile" ADD CONSTRAINT "ProgrammingProfile_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammingTask" ADD CONSTRAINT "ProgrammingTask_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "ProgrammingConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammingTask" ADD CONSTRAINT "ProgrammingTask_hintTemplateId_fkey" FOREIGN KEY ("hintTemplateId") REFERENCES "ProgrammingHintTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammingTask" ADD CONSTRAINT "ProgrammingTask_feedbackTemplateId_fkey" FOREIGN KEY ("feedbackTemplateId") REFERENCES "ProgrammingFeedbackTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_focusConceptId_fkey" FOREIGN KEY ("focusConceptId") REFERENCES "ProgrammingConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerProgrammingPersona" ADD CONSTRAINT "LearnerProgrammingPersona_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerProgrammingPersona" ADD CONSTRAINT "LearnerProgrammingPersona_focusConceptId_fkey" FOREIGN KEY ("focusConceptId") REFERENCES "ProgrammingConcept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerProgrammingConceptState" ADD CONSTRAINT "LearnerProgrammingConceptState_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearnerProgrammingConceptState" ADD CONSTRAINT "LearnerProgrammingConceptState_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "ProgrammingConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelemetryEvent" ADD CONSTRAINT "TelemetryEvent_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
