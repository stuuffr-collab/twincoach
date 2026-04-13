"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  fetchSession,
  isDailyPracticeSession,
  recordTelemetryEvent,
  submitAnswer,
  type AnswerSubmitResponse,
  type DailySessionPayload,
} from "@/src/lib/api";
import {
  getHelpKindLabel,
  getProgrammingTaskTypeLabel,
  getSessionModeTone,
} from "@/src/lib/programming-ui";

export default function DailySessionPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId;

  const [session, setSession] = useState<DailySessionPayload | null>(null);
  const [answerValue, setAnswerValue] = useState("");
  const [feedback, setFeedback] = useState<AnswerSubmitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  const [error, setError] = useState("");
  const taskPresentedAtRef = useRef<number | null>(null);
  const firstActionAtRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const payload = await fetchSession(sessionId);
        if (cancelled) {
          return;
        }

        if (!isDailyPracticeSession(payload)) {
          router.replace("/diagnostic");
          return;
        }

        setSession(payload);
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.message === "Session completed") {
          router.replace(`/session/${sessionId}/summary`);
          return;
        }

        if (!cancelled) {
          setError("Unable to load your daily programming session.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (sessionId) {
      void loadSession();
    }

    return () => {
      cancelled = true;
    };
  }, [router, sessionId]);

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
      eventName: "tc_session_task_viewed",
      route: `/session/${session.sessionId}`,
      sessionId: session.sessionId,
      sessionItemId: session.currentTask.sessionItemId,
      properties: {
        sessionId: session.sessionId,
        sessionMode: session.sessionMode,
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
    session?.sessionMode,
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
        eventName: "tc_session_answer_submitted",
        route: `/session/${session.sessionId}`,
        sessionId: session.sessionId,
        sessionItemId: session.currentTask.sessionItemId,
        properties: {
          sessionId: session.sessionId,
          sessionMode: session.sessionMode,
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
      setIsHelpVisible(false);
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        if (
          submitError.message === "Stale submit" ||
          submitError.message === "Duplicate submit" ||
          submitError.message === "Session item mismatch"
        ) {
          await recoverLatestSession(
            "We refreshed your latest saved question so you can continue safely.",
          );
          return;
        }

        if (submitError.message === "Session completed") {
          router.replace(`/session/${session.sessionId}/summary`);
          return;
        }
      }

      setError("We couldn't save that answer yet. Your session is still saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleContinue() {
    if (!session || !feedback) {
      return;
    }

    if (feedback.sessionStatus === "completed") {
      router.replace(`/session/${session.sessionId}/summary`);
      return;
    }

    setIsAdvancing(true);
    setError("");

    try {
      const nextSession = await fetchSession(session.sessionId);

      if (!isDailyPracticeSession(nextSession)) {
        router.replace("/today");
        return;
      }

      setSession(nextSession);
      setAnswerValue("");
      setFeedback(null);
      setIsHelpVisible(false);
    } catch (advanceError) {
      if (advanceError instanceof ApiError && advanceError.message === "Session completed") {
        router.replace(`/session/${session.sessionId}/summary`);
        return;
      }

      setError("We couldn't load the next practice step yet. Try again.");
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

      if (!isDailyPracticeSession(latestSession)) {
        router.replace("/today");
        return;
      }

      setSession(latestSession);
      setAnswerValue("");
      setFeedback(null);
      setIsHelpVisible(false);
      setError(nextError);
    } catch (recoveryError) {
      if (recoveryError instanceof ApiError && recoveryError.message === "Session completed") {
        router.replace(`/session/${session.sessionId}/summary`);
        return;
      }

      setError("We couldn't restore your saved session state. Refresh and try again.");
    }
  }

  function handleToggleHelp() {
    const helpOffer = feedback?.helpOffer;

    if (!helpOffer) {
      return;
    }

    setIsHelpVisible((current) => {
      const nextValue = !current;

      if (nextValue && session) {
        void recordTelemetryEvent({
          eventName: "tc_session_help_revealed",
          route: `/session/${session.sessionId}`,
          sessionId: session.sessionId,
          sessionItemId: session.currentTask.sessionItemId,
          properties: {
            sessionId: session.sessionId,
            sessionItemId: session.currentTask.sessionItemId,
            taskId: session.currentTask.taskId,
            conceptId: session.currentTask.conceptId,
            helpKind: helpOffer.helpKind,
          },
        }).catch(() => undefined);
      }

      return nextValue;
    });
  }

  const primaryLabel = feedback
    ? feedback.sessionStatus === "completed"
      ? "View your recap"
      : "Continue"
    : isSubmitting
      ? "Saving..."
      : "Submit answer";

  return (
    <StudentShell>
      <PageHeader
        detail="This session stays focused on one short Python step at a time, and your progress is saved as you go."
        eyebrow="Today's session"
        subtitle="Guided daily practice shaped by your recent programming work."
        title="Keep your momentum going"
      />

      {session ? (
        <ProgressBar
          badgeText="Saved as you go"
          currentIndex={session.currentIndex}
          label={session.sessionModeLabel}
          supportingText="Focus on one task, one correction, and one next step at a time."
          tone="session"
          totalItems={session.totalItems}
        />
      ) : null}

      <section className="flex flex-1 flex-col gap-4 px-4 py-4">
        {loading ? (
          <StatePanel
            description="We're loading today's next saved Python practice step."
            eyebrow="Today's practice"
            title="Loading your guided practice..."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            description={error}
            eyebrow="Session update"
            title="We hit a temporary issue."
            tone={error.includes("refreshed") || error.includes("restore") ? "recovery" : "error"}
          />
        ) : null}

        {session ? (
          <>
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getSessionModeTone(session.sessionMode)}`}
                >
                  {session.sessionModeLabel}
                </span>
                <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">
                  Focus: {session.focusConceptLabel}
                </span>
              </div>
              {session.currentTask.helpAvailable && !feedback ? (
                <div className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                  {session.currentTask.helpLabel ?? "Hint available"}:{" "}
                  {session.currentTask.helpKind
                    ? `${getHelpKindLabel(session.currentTask.helpKind)} support can appear after an incorrect answer if you need it.`
                    : "A structured hint can appear after an incorrect answer if you need it."}
                </div>
              ) : null}
            </div>

            <QuestionCard
              codeSnippet={session.currentTask.codeSnippet}
              eyebrow="Today's task"
              helper={session.currentTask.helperText}
              stem={session.currentTask.prompt}
              taskTypeLabel={getProgrammingTaskTypeLabel(session.currentTask.taskType)}
              tone="session"
            >
              <AnswerInputSwitcher
                answerFormat={session.currentTask.answerFormat}
                choices={session.currentTask.choices}
                onChange={handleAnswerChange}
                taskType={session.currentTask.taskType}
                value={answerValue}
              />
            </QuestionCard>
          </>
        ) : null}

        {feedback ? (
          <FeedbackCard
            context="session"
            feedbackText={feedback.feedbackText}
            feedbackType={feedback.feedbackType}
          />
        ) : null}

        {feedback?.helpOffer ? (
          <div className="rounded-[1.5rem] border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-800">
                  {getHelpKindLabel(feedback.helpOffer.helpKind)}
                </div>
                <div className="mt-2 text-sm leading-6 text-blue-900">
                  Reveal a structured hint if you want one more nudge before moving on.
                </div>
              </div>
              <button
                className="rounded-full border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-900 shadow-sm"
                onClick={handleToggleHelp}
                type="button"
              >
                {isHelpVisible ? "Hide hint" : feedback.helpOffer.label}
              </button>
            </div>
            {isHelpVisible ? (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-4 text-sm leading-6 text-[var(--text)] shadow-sm">
                {feedback.helpOffer.text}
              </div>
            ) : null}
          </div>
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
              ? "We'll take you to your saved session recap."
              : "Your answer is saved. Continue when you're ready."
            : "Your session is saved after each answer."
        }
      />
    </StudentShell>
  );
}
