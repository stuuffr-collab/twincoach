"use client";

import { useEffect, useMemo, useState } from "react";
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
          await recoverLatestSession(
            "We refreshed your latest saved question so you can keep going safely.",
          );
          return;
        }

        if (error.message === "Session completed" || error.message === "Diagnostic completed") {
          router.replace("/today");
          return;
        }
      }

      setError("We couldn't save that answer yet. Your place is still saved.");
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

      setError("We couldn't load the next question yet. Try again.");
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

      setError("We couldn't restore your saved question. Refresh and try again.");
    }
  }

  const primaryLabel = feedback
    ? feedback.sessionStatus === "completed"
      ? "Go to Today"
      : "Continue"
    : isSubmitting
      ? "Saving..."
      : "Submit answer";

  return (
    <StudentShell>
      <PageHeader
        detail="This is a short setup step. It is not graded and it helps us choose your best next step."
        eyebrow="Diagnostic"
        subtitle="Answer one question at a time so we can build your starting study plan."
        title="Build your starting plan"
      />

      {session ? (
        <ProgressBar
          badgeText="Not graded"
          currentIndex={session.currentIndex}
          label="Diagnostic progress"
          supportingText="Answer as best you can. We'll use this to guide today's plan."
          tone="diagnostic"
          totalItems={session.totalItems}
        />
      ) : null}

      <section className="flex flex-1 flex-col gap-4 px-4 py-4">
        {loading ? (
          <StatePanel
            description="We're opening the short setup questions that shape your first study plan."
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
            eyebrow="Diagnostic question"
            helper="Take your best next step. We'll handle what comes after this question."
            stem={session.currentItem.stem}
            tone="diagnostic"
          >
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
              ? "We'll take you straight to today's plan."
              : "Your answer is saved. Continue when you're ready."
            : "This setup is saved question by question."
        }
      />
    </StudentShell>
  );
}
