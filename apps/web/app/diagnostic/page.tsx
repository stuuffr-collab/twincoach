"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnswerInputSwitcher } from "@/src/components/answer-input-switcher";
import { FeedbackCard } from "@/src/components/feedback-card";
import { InlineReveal } from "@/src/components/inline-reveal";
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
          setError("تعذّر تحميل خطوة التهيئة الأولى الآن.");
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
          await recoverLatestSession("أعدنا آخر خطوة محفوظة حتى تتابع بأمان.");
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

      setError("تعذّر حفظ هذه الخطوة الآن، لكن تقدّمك ما زال محفوظًا.");
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

      setError("تعذّر تحميل خطوة التهيئة التالية الآن. جرّب مرة أخرى.");
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

      setError("تعذّر استعادة حالة التهيئة المحفوظة. حدّث الصفحة ثم جرّب مرة أخرى.");
    }
  }

  const primaryLabel = feedback
    ? feedback.sessionStatus === "completed"
      ? "الانتقال إلى حالتك اليوم"
      : "متابعة"
    : isSubmitting
      ? "نثبّت الإجابة..."
      : "تثبيت الإجابة";

  return (
    <StudentShell>
      <PageHeader
        eyebrow="التهيئة الأولى"
        subtitle="خطوات قصيرة وآمنة حتى نفهم من أين نبدأ معك."
        title="نضبط نقطة البداية"
      />

      {session ? (
        <ProgressBar
          badgeText="ليست درجة"
          currentIndex={session.currentIndex}
          label="تقدّم التهيئة"
          tone="diagnostic"
          totalItems={session.totalItems}
        />
      ) : null}

      <section className="flex flex-1 flex-col gap-4 px-4 py-4 md:px-6">
        {loading ? (
          <StatePanel
            description="نحضّر أول خطوة قصيرة لك."
            eyebrow="تهيئة البداية"
            title="نجهّز البداية..."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            description={error}
            eyebrow="تحديث التهيئة"
            title="ظهر خلل مؤقت."
            tone={error.includes("أعدنا") || error.includes("استعادة") ? "recovery" : "error"}
          />
        ) : null}

        {session ? (
          <>
            <div className="motion-rise stage-card rounded-[1.85rem] p-5">
              <div className="flex flex-wrap gap-2">
                <span className="support-chip">خطوة آمنة وغير تقييمية</span>
                <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--text)] shadow-sm">
                  نتعلّم كيف نوجّه تدريبك
                </span>
              </div>
              <div className="mt-4 text-sm leading-7 text-[var(--text)]">
                لا نبحث هنا عن إجابة مثالية من أول مرة، بل عن أفضل نقطة انطلاق لك.
              </div>
              <div className="mt-4">
                <InlineReveal label="لماذا هذه الخطوة؟" tone="soft">
                  نستخدم هذه الخطوات القصيرة لنفهم أين يبدأ التركيز، وما نوع الدعم الذي يفيدك أكثر.
                </InlineReveal>
              </div>
            </div>

            <QuestionCard
              codeSnippet={session.currentTask.codeSnippet}
              eyebrow="خطوة تهيئة"
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
          </>
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
              ? "بعد هذه الخطوة ننتقل إلى حالتك اليوم."
              : "خطوتك محفوظة، ويمكنك المتابعة."
            : "نحفظ كل خطوة قبل الانتقال لما بعدها."
        }
      />
    </StudentShell>
  );
}
