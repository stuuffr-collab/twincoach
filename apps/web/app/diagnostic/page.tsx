"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnswerInputSwitcher } from "@/src/components/answer-input-switcher";
import { FeedbackCard } from "@/src/components/feedback-card";
import { PageHeader } from "@/src/components/page-header";
import { ProgressBar } from "@/src/components/progress-bar";
import { QuestionCard } from "@/src/components/question-card";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import {
  ApiError,
  createOrResumeDiagnostic,
  fetchSession,
  submitAnswer,
  type AnswerSubmitResponse,
  type SessionPayload,
} from "@/src/lib/api";

export default function DiagnosticPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [answerValue, setAnswerValue] = useState("");
  const [feedback, setFeedback] = useState<AnswerSubmitResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDiagnostic() {
      try {
        const payload = await createOrResumeDiagnostic();
        if (cancelled) {
          return;
        }

        setSession(payload);
      } catch (error) {
        if (error instanceof ApiError && error.message === "Diagnostic completed") {
          router.replace("/today");
          return;
        }

        if (!cancelled) {
          setError("Unable to load your diagnostic.");
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
  }, []);

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
    } catch (error) {
      if (error instanceof ApiError) {
        if (
          error.message === "Stale submit" ||
          error.message === "Duplicate submit" ||
          error.message === "Session item mismatch"
        ) {
          await recoverLatestSession("Your session was updated. Continue from the latest question.");
          return;
        }

        if (error.message === "Session completed" || error.message === "Diagnostic completed") {
          router.replace("/today");
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
      router.replace("/today");
      return;
    }

    setIsAdvancing(true);
    setError("");

    try {
      const nextSession = await fetchSession(session.sessionId);
      setSession(nextSession);
      setAnswerValue("");
      setFeedback(null);
    } catch (error) {
      if (error instanceof ApiError && error.message === "Session completed") {
        router.replace("/today");
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
        router.replace("/today");
        return;
      }

      setError("We couldn't restore your diagnostic. Refresh and try again.");
    }
  }

  const primaryLabel = feedback
    ? feedback.sessionStatus === "completed"
      ? "Go to Today"
      : "Next question"
    : isSubmitting
      ? "Saving..."
      : "Submit answer";

  return (
    <StudentShell>
      <PageHeader
        title="Diagnostic"
        subtitle="Answer each question to build your first study plan."
      />

      {session ? (
        <ProgressBar currentIndex={session.currentIndex} totalItems={session.totalItems} />
      ) : null}

      <section className="flex flex-1 flex-col gap-4 px-4 py-4">
        {loading ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
            Loading your diagnostic...
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
