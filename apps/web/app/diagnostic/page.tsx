"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnswerInputSwitcher } from "@/src/components/answer-input-switcher";
import { FeedbackCard } from "@/src/components/feedback-card";
import { PageHeader } from "@/src/components/page-header";
import { ProgressBar } from "@/src/components/progress-bar";
import { QuestionCard } from "@/src/components/question-card";
import { StatePanel } from "@/src/components/state-panel";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import {
  ApiError,
  createOrResumeDiagnostic,
  fetchSession,
  recordTelemetryEvent,
  submitAnswer,
  type AnswerSubmitResponse,
  type DiagnosticSessionPayload,
} from "@/src/lib/api";
import { getProgrammingTaskTypeLabel } from "@/src/lib/programming-ui";

export default function DiagnosticPage() {
  const router = useRouter();
  const [session, setSession] = useState<DiagnosticSessionPayload | null>(null);
  const [answerValue, setAnswerValue] = useState("");
  const [feedback, setFeedback] = useState<AnswerSubmitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState("");
  const taskPresentedAtRef = useRef<number | null>(null);
  const firstActionAtRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDiagnostic() {
      try {
        const payload = await createOrResumeDiagnostic();
        if (cancelled) {
          return;
        }

        setSession(payload);
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.message === "Diagnostic completed") {
          router.replace("/today");
          return;
        }

        if (!cancelled) {
          setError("Unable to load your programming diagnostic.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDiagnostic();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const canSubmit = useMemo(() => {
    return Boolean(session && answerValue.trim().length > 0 && !feedback);
  }, [answerValue, feedback, session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    taskPresentedAtRef.current = Date.now();
    firstActionAtRef.current = null;

    void recordTelemetryEvent({
      eventName: "tc_diagnostic_task_viewed",
      route: "/diagnostic",
      sessionId: session.sessionId,
      sessionItemId: session.currentTask.sessionItemId,
      properties: {
        sessionId: session.sessionId,
        sessionItemId: session.currentTask.sessionItemId,
        taskId: session.currentTask.taskId,
        conceptId: session.currentTask.conceptId,
        taskType: session.currentTask.taskType,
        currentIndex: session.currentIndex,
        totalItems: session.totalItems,
      },
    }).catch(() => undefined);
  }, [
    session?.sessionId,
    session?.currentIndex,
    session?.totalItems,
    session?.currentTask.conceptId,
    session?.currentTask.sessionItemId,
    session?.currentTask.taskId,
    session?.currentTask.taskType,
  ]);

  function handleAnswerChange(nextValue: string) {
    if (firstActionAtRef.current === null) {
      firstActionAtRef.current = Date.now();
    }

    setAnswerValue(nextValue);
  }

  async function handleSubmit() {
    if (!session || !canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const presentedAt = taskPresentedAtRef.current ?? Date.now();
      const response = await submitAnswer({
        sessionId: session.sessionId,
        sessionItemId: session.currentTask.sessionItemId,
        answerValue,
        checkpointToken: session.checkpointToken,
      });

      void recordTelemetryEvent({
        eventName: "tc_diagnostic_answer_submitted",
        route: "/diagnostic",
        sessionId: session.sessionId,
        sessionItemId: session.currentTask.sessionItemId,
        properties: {
          sessionId: session.sessionId,
          sessionItemId: session.currentTask.sessionItemId,
          taskId: session.currentTask.taskId,
          conceptId: session.currentTask.conceptId,
          taskType: session.currentTask.taskType,
          attemptCount: 1,
          timeToFirstActionMs: Math.max(
            0,
            (firstActionAtRef.current ?? presentedAt) - presentedAt,
          ),
          timeToSubmitMs: Math.max(0, Date.now() - presentedAt),
          isCorrect: response.isCorrect,
        },
      }).catch(() => undefined);

      setFeedback(response);
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        if (
          submitError.message === "Stale submit" ||
          submitError.message === "Duplicate submit" ||
          submitError.message === "Session item mismatch"
        ) {
          await recoverLatestSession(
            "We refreshed your latest saved question so you can keep going safely.",
          );
          return;
        }

        if (
          submitError.message === "Session completed" ||
          submitError.message === "Diagnostic completed"
        ) {
          router.replace("/today");
          return;
        }
      }

      setError("We couldn't save that answer yet. Your diagnostic is still safe.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleContinue() {
    if (!session || !feedback) {
      return;
    }

    if (feedback.sessionStatus === "completed") {
      router.replace("/today");
      return;
    }

    setIsAdvancing(true);
    setError("");

    try {
      const nextSession = await fetchSession(session.sessionId);

      if (nextSession.sessionType !== "diagnostic") {
        router.replace("/today");
        return;
      }

      setSession(nextSession);
      setAnswerValue("");
      setFeedback(null);
    } catch (advanceError) {
      if (advanceError instanceof ApiError && advanceError.message === "Session completed") {
        router.replace("/today");
        return;
      }

      setError("We couldn't load the next diagnostic step yet. Try again.");
    } finally {
      setIsAdvancing(false);
    }
  }

  async function recoverLatestSession(nextError: string) {
    if (!session) {
      return;
    }

    try {
      const latestSession = await fetchSession(session.sessionId);

      if (latestSession.sessionType !== "diagnostic") {
        router.replace("/today");
        return;
      }

      setSession(latestSession);
      setAnswerValue("");
      setFeedback(null);
      setError(nextError);
    } catch (recoveryError) {
      if (recoveryError instanceof ApiError && recoveryError.message === "Session completed") {
        router.replace("/today");
        return;
      }

      setError("We couldn't restore your saved diagnostic state. Refresh and try again.");
    }
  }

  const primaryLabel = feedback
    ? feedback.sessionStatus === "completed"
      ? "Go to Your Programming State"
      : "Continue"
    : isSubmitting
      ? "Saving..."
      : "Submit answer";

  return (
    <StudentShell>
      <PageHeader
        detail="This is a short setup step. It is not graded. It only helps TwinCoach choose the right first study mode."
        eyebrow="Programming diagnostic"
        subtitle="Answer one short programming task at a time so we can build your first Python study state."
        title="Build your starting programming plan"
      />

      {session ? (
        <ProgressBar
          badgeText="Not graded"
          currentIndex={session.currentIndex}
          label="Diagnostic progress"
          supportingText="Take your best next step on each task. We use this to shape your first guided practice session."
          tone="diagnostic"
          totalItems={session.totalItems}
        />
      ) : null}

      <section className="flex flex-1 flex-col gap-4 px-4 py-4">
        {loading ? (
          <StatePanel
            description="We're opening the short Python setup tasks that shape your first study plan."
            eyebrow="Diagnostic setup"
            title="Getting your diagnostic ready..."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            description={error}
            eyebrow="Diagnostic update"
            title="We hit a temporary issue."
            tone={error.includes("refreshed") || error.includes("restore") ? "recovery" : "error"}
          />
        ) : null}

        {session ? (
          <QuestionCard
            codeSnippet={session.currentTask.codeSnippet}
            eyebrow="Diagnostic task"
            helper={session.currentTask.helperText}
            stem={session.currentTask.prompt}
            taskTypeLabel={getProgrammingTaskTypeLabel(session.currentTask.taskType)}
            tone="diagnostic"
          >
            <AnswerInputSwitcher
              answerFormat={session.currentTask.answerFormat}
              choices={session.currentTask.choices}
              onChange={handleAnswerChange}
              taskType={session.currentTask.taskType}
              value={answerValue}
            />
          </QuestionCard>
        ) : null}

        {feedback ? (
          <FeedbackCard
            context="diagnostic"
            feedbackText={feedback.feedbackText}
            feedbackType={feedback.feedbackType}
          />
        ) : null}
      </section>

      <StickyActionBar
        disabled={
          loading ||
          !session ||
          isSubmitting ||
          isAdvancing ||
          (!feedback && !canSubmit)
        }
        label={primaryLabel}
        onClick={feedback ? handleContinue : handleSubmit}
        supportingText={
          feedback
            ? feedback.sessionStatus === "completed"
              ? "We'll take you straight to Your Programming State."
              : "Your answer is saved. Continue when you're ready."
            : "Each diagnostic answer is saved before the next task appears."
        }
      />
    </StudentShell>
  );
}
