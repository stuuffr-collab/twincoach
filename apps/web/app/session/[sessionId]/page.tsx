"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnswerInputSwitcher } from "@/src/components/answer-input-switcher";
import { FeedbackCard } from "@/src/components/feedback-card";
import { PageHeader } from "@/src/components/page-header";
import { ProgressBar } from "@/src/components/progress-bar";
import { QuestionCard } from "@/src/components/question-card";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import {
  ApiError,
  fetchSession,
  submitAnswer,
  type AnswerSubmitResponse,
  type SessionPayload,
} from "@/src/lib/api";

export default function DailySessionPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId;

  const [session, setSession] = useState<SessionPayload | null>(null);
  const [answerValue, setAnswerValue] = useState("");
  const [feedback, setFeedback] = useState<AnswerSubmitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const payload = await fetchSession(sessionId);
        if (cancelled) {
          return;
        }

        setSession(payload);
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.message === "Session completed") {
          router.replace(`/session/${sessionId}/summary`);
          return;
        }

        if (!cancelled) {
          setError("Unable to load your daily session.");
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

  async function handleSubmit() {
    if (!session || !canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await submitAnswer({
        sessionId: session.sessionId,
        sessionItemId: session.currentItem.sessionItemId,
        answerValue,
        checkpointToken: session.checkpointToken,
      });

      setFeedback(response);
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        if (
          submitError.message === "Stale submit" ||
          submitError.message === "Duplicate submit" ||
          submitError.message === "Session item mismatch"
        ) {
          await recoverLatestSession(
            "Your session was updated. Continue from the latest question.",
          );
          return;
        }

        if (submitError.message === "Session completed") {
          router.replace(`/session/${session.sessionId}/summary`);
          return;
        }
      }

      setError("We couldn't save that answer. Try again.");
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
      setSession(nextSession);
      setAnswerValue("");
      setFeedback(null);
    } catch (advanceError) {
      if (advanceError instanceof ApiError && advanceError.message === "Session completed") {
        router.replace(`/session/${session.sessionId}/summary`);
        return;
      }

      setError("We couldn't load the next question.");
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
      setSession(latestSession);
      setAnswerValue("");
      setFeedback(null);
      setError(nextError);
    } catch (recoveryError) {
      if (recoveryError instanceof ApiError && recoveryError.message === "Session completed") {
        router.replace(`/session/${session.sessionId}/summary`);
        return;
      }

      setError("We couldn't restore your session. Refresh and try again.");
    }
  }

  const primaryLabel = feedback
    ? feedback.sessionStatus === "completed"
      ? "View session summary"
      : "Next question"
    : isSubmitting
      ? "Saving..."
      : "Submit answer";

  return (
    <StudentShell>
      <PageHeader
        title="Daily Session"
        subtitle="Work through today's short practice set."
      />

      {session ? (
        <ProgressBar currentIndex={session.currentIndex} totalItems={session.totalItems} />
      ) : null}

      <section className="flex flex-1 flex-col gap-4 px-4 py-4">
        {loading ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
            Loading your daily session...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {session ? (
          <QuestionCard stem={session.currentItem.stem}>
            <AnswerInputSwitcher
              choices={session.currentItem.choices}
              onChange={setAnswerValue}
              questionType={session.currentItem.questionType}
              value={answerValue}
            />
          </QuestionCard>
        ) : null}

        {feedback ? (
          <FeedbackCard
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
      />
    </StudentShell>
  );
}
