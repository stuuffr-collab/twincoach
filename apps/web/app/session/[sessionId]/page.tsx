"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ActiveCourseContextCard } from "@/src/components/active-course-context-card";
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
  fetchSession,
  isDailyPracticeSession,
  recordTelemetryEvent,
  submitAnswer,
  type AnswerSubmitResponse,
  type DailySessionPayload,
} from "@/src/lib/api";
import {
  getRefreshFollowThroughPresentation,
  getRefreshPresentation,
  getRefreshResolutionPresentation,
} from "@/src/lib/course-pack-refresh-presentation";
import { getRecurringFocusPresentation } from "@/src/lib/course-pack-recurring-presentation";
import {
  getHelpKindLabel,
  getProgrammingTaskTypeLabel,
  getSessionModeLabel,
  getSessionModeTone,
} from "@/src/lib/programming-ui";
import { getSupportLevelPresentation } from "@/src/lib/support-level-presentation";

function getModeSupportText(session: DailySessionPayload) {
  switch (session.sessionMode) {
    case "recovery_mode":
      return "جلسة أخف حتى تعود للحركة بثبات.";
    case "debugging_drill":
      return "نقودك خطوة بخطوة داخل إصلاح الخطأ.";
    case "concept_repair":
      return "هناك فكرة واحدة تحتاج تركيزًا أوضح الآن.";
    default:
      return "نحافظ على تقدمك بإيقاع ثابت وواضح.";
  }
}

function getSessionCourseContextCopy(session: DailySessionPayload) {
  switch (session.activeCourseContext?.supportLevel) {
    case "full_coach":
      return "هذه الجلسة مبنية مباشرة على المقرر الذي فعلته، لذلك يبقى التدريب مربوطًا بالمفهوم الحالي داخل موادك المؤكدة.";
    case "guided_study":
      return "هذه الجلسة تتحرك مع خريطة المقرر المؤكدة، وتبقي اللغة واضحة حول ما يمكن دعمه بعمق وما يبقى في نطاق التوجيه الدراسي.";
    case "planning_review":
      return "هذه الجلسة تخدم خطة المراجعة المؤكدة لهذا المقرر، حتى تبقى الخطوة الحالية مرتبطة بأولوية واقعية من موادك.";
    default:
      return getModeSupportText(session);
  }
}

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
        if (
          loadError instanceof ApiError &&
          loadError.message === "Session completed"
        ) {
          router.replace(`/session/${sessionId}/summary`);
          return;
        }

        if (!cancelled) {
          setError("تعذر تحميل تدريب اليوم الآن.");
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
            "أعدنا آخر خطوة محفوظة حتى تكمل من المكان الصحيح.",
          );
          return;
        }

        if (submitError.message === "Session completed") {
          router.replace(`/session/${session.sessionId}/summary`);
          return;
        }
      }

      setError("تعذر حفظ هذه الخطوة الآن، لكن تقدمك ما زال محفوظًا.");
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
      if (
        advanceError instanceof ApiError &&
        advanceError.message === "Session completed"
      ) {
        router.replace(`/session/${session.sessionId}/summary`);
        return;
      }

      setError("تعذر تحميل الخطوة التالية الآن. جرّب مرة أخرى.");
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
      if (
        recoveryError instanceof ApiError &&
        recoveryError.message === "Session completed"
      ) {
        router.replace(`/session/${session.sessionId}/summary`);
        return;
      }

      setError("تعذر استعادة الجلسة المحفوظة. حدّث الصفحة ثم جرّب مرة أخرى.");
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
      ? "عرض الخلاصة"
      : "متابعة"
    : isSubmitting
      ? "نثبّت الإجابة..."
      : "تثبيت الإجابة";

  const supportLevelPresentation = getSupportLevelPresentation(
    session?.activeCourseContext?.supportLevel ?? null,
  );
  const refreshPresentation = useMemo(() => {
    if (
      !session?.activeCourseContext ||
      !session.refreshHandoff?.isFirstSessionAfterRefresh
    ) {
      return null;
    }

    return getRefreshPresentation("session", {
      courseTitle: session.activeCourseContext.courseTitle,
      focusLabel:
        session.activeCourseContext.focusNormalizedConceptLabel ??
        session.focusConceptLabel,
      refreshContext: session.refreshHandoff,
    });
  }, [session]);
  const followThroughPresentation = useMemo(() => {
    if (
      !session?.activeCourseContext?.followThrough ||
      !session.refreshHandoff?.isFollowThroughSession
    ) {
      return null;
    }

    return getRefreshFollowThroughPresentation("session", {
      courseTitle: session.activeCourseContext.courseTitle,
      focusLabel:
        session.activeCourseContext.followThrough.targetLabel ??
        session.activeCourseContext.focusNormalizedConceptLabel ??
        session.focusConceptLabel,
      followThrough: session.activeCourseContext.followThrough,
    });
  }, [session]);
  const resolutionPresentation = useMemo(() => {
    if (
      !session?.activeCourseContext?.resolution ||
      session.refreshHandoff?.isFirstSessionAfterRefresh ||
      session.refreshHandoff?.isFollowThroughSession
    ) {
      return null;
    }

    return getRefreshResolutionPresentation("session", {
      courseTitle: session.activeCourseContext.courseTitle,
      focusLabel:
        session.activeCourseContext.focusNormalizedConceptLabel ??
        session.focusConceptLabel,
      resolution: session.activeCourseContext.resolution,
    });
  }, [session]);
  const recurringPresentation = useMemo(() => {
    if (
      !session?.activeCourseContext ||
      !session.recurringFocusDecision ||
      refreshPresentation ||
      followThroughPresentation ||
      resolutionPresentation
    ) {
      return null;
    }

    return getRecurringFocusPresentation("session", {
      courseTitle: session.activeCourseContext.courseTitle,
      decision: session.recurringFocusDecision,
    });
  }, [
    followThroughPresentation,
    refreshPresentation,
    resolutionPresentation,
    session,
  ]);

  return (
    <StudentShell>
      <PageHeader
        eyebrow="تدريب اليوم"
        subtitle="خطوة واحدة محفوظة في كل مرة."
        title="نكمل تدريبك بوضوح وهدوء"
      />

      {session ? (
        <ProgressBar
          badgeText="محفوظ أولًا بأول"
          currentIndex={session.currentIndex}
          label={getSessionModeLabel(session.sessionMode)}
          tone="session"
          totalItems={session.totalItems}
        />
      ) : null}

      <section className="flex flex-1 flex-col gap-4 px-4 py-4 md:px-6">
        {loading ? (
          <StatePanel
            description="نستعيد آخر خطوة محفوظة لك."
            eyebrow="تدريب اليوم"
            title="نحضر الجلسة..."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            description={error}
            eyebrow="تحديث الجلسة"
            title="ظهر خلل مؤقت."
            tone={
              error.includes("أعدنا") || error.includes("استعادة")
                ? "recovery"
                : "error"
            }
          />
        ) : null}

        {session ? (
          <>
            {refreshPresentation ? (
              <div className="space-y-3">
                <StatePanel
                  description={refreshPresentation.description}
                  eyebrow="إعادة دخول بعد تحديث المقرر"
                  title={refreshPresentation.title}
                  tone="recovery"
                />
                <div className="rounded-[1.4rem] border border-blue-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm">
                      {refreshPresentation.reasonChip}
                    </span>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm">
                      أول جلسة بعد التحديث
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                    {refreshPresentation.supportingText}
                  </div>
                </div>
              </div>
            ) : followThroughPresentation ? (
              <div className="space-y-3">
                <StatePanel
                  description={followThroughPresentation.description}
                  eyebrow="متابعة لنفس الجزء"
                  title={followThroughPresentation.title}
                  tone="recovery"
                />
                <div className="rounded-[1.4rem] border border-blue-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm">
                      {followThroughPresentation.reasonChip}
                    </span>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm">
                      استكمال قصير مقصود
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                    {followThroughPresentation.supportingText}
                  </div>
                </div>
              </div>
            ) : resolutionPresentation ? (
              <div className="space-y-3">
                <StatePanel
                  description={resolutionPresentation.description}
                  eyebrow="عودة مقصودة إلى المسار الطبيعي"
                  title={resolutionPresentation.title}
                  tone="recovery"
                />
                <div className="rounded-[1.4rem] border border-blue-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm">
                      {resolutionPresentation.reasonChip}
                    </span>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm">
                      أول خطوة بعد انتهاء المتابعة
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                    {resolutionPresentation.supportingText}
                  </div>
                </div>
              </div>
            ) : recurringPresentation ? (
              <div className="space-y-3">
                <StatePanel
                  description={recurringPresentation.description}
                  eyebrow="استمرارية هذا الجزء"
                  title={recurringPresentation.title}
                  tone="recovery"
                />
                <div className="rounded-[1.4rem] border border-blue-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm">
                      {recurringPresentation.reasonChip}
                    </span>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm">
                      {session.recurringFocusDecision?.nextStepIntent === "stay"
                        ? "ليست إعادة عشوائية"
                        : "انتقال مقصود"}
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                    {recurringPresentation.supportingText}
                  </div>
                </div>
              </div>
            ) : null}

            {session.activeCourseContext ? (
              <ActiveCourseContextCard
                activeCourseContext={session.activeCourseContext}
                compact
                description={getSessionCourseContextCopy(session)}
                eyebrow="هذه الجلسة مرتبطة بمقررك النشط"
                focusLabel={
                  session.activeCourseContext.focusNormalizedConceptLabel ??
                  session.focusConceptLabel
                }
                linkLabel="راجع إعداد المقرر"
              />
            ) : null}

            <div className="motion-rise stage-card rounded-[1.9rem] p-5">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getSessionModeTone(session.sessionMode)}`}
                >
                  {getSessionModeLabel(session.sessionMode)}
                </span>
                {session.activeCourseContext ? (
                  <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">
                    من {session.activeCourseContext.courseTitle}
                  </span>
                ) : null}
                <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">
                  التركيز: {session.focusConceptLabel}
                </span>
                <span className="support-chip">تقدمك محفوظ</span>
              </div>

              <div className="mt-4 text-sm leading-7 text-[var(--text)]">
                {session.activeCourseContext
                  ? getSessionCourseContextCopy(session)
                  : getModeSupportText(session)}
              </div>

              {session.activeCourseContext ? (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[1.3rem] border border-[var(--border)] bg-white/82 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-[var(--text-muted)]">
                      {supportLevelPresentation.session.expectationTitle}
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[var(--text)]">
                      {supportLevelPresentation.session.expectationText}
                    </div>
                  </div>
                  <div className="rounded-[1.3rem] border border-[var(--border)] bg-white/82 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-[var(--text-muted)]">
                      {supportLevelPresentation.session.evaluationTitle}
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[var(--text)]">
                      {supportLevelPresentation.session.evaluationText}
                    </div>
                  </div>
                  <div className="rounded-[1.3rem] border border-[var(--border)] bg-white/82 p-4 shadow-sm">
                    <div className="text-xs font-semibold text-[var(--text-muted)]">
                      {supportLevelPresentation.session.outcomeTitle}
                    </div>
                    <div className="mt-2 text-sm leading-7 text-[var(--text)]">
                      {supportLevelPresentation.session.outcomeText}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                <InlineReveal label="لماذا هذا الآن؟" tone="soft">
                  {session.activeCourseContext
                    ? supportLevelPresentation.session.helpHint
                    : getModeSupportText(session)}
                </InlineReveal>

                {session.currentTask.helpAvailable ? (
                  <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--text-muted)] shadow-sm">
                    {session.currentTask.helpKind
                      ? `دعم متكيف: ${getHelpKindLabel(session.currentTask.helpKind)}`
                      : session.activeCourseContext
                        ? supportLevelPresentation.session.helpHint
                        : session.currentTask.helpLabel ?? "يمكن إظهار خطوة مساعدة"}
                  </span>
                ) : null}
              </div>
            </div>

            <QuestionCard
              codeSnippet={session.currentTask.codeSnippet}
              eyebrow="الخطوة الحالية"
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
          <div className="motion-reveal rounded-[1.55rem] border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-blue-900">
                {getHelpKindLabel(feedback.helpOffer.helpKind)}
              </div>
              <button
                className="rounded-full border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-blue-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={handleToggleHelp}
                type="button"
              >
                {isHelpVisible ? "إخفاء المساعدة" : feedback.helpOffer.label}
              </button>
            </div>
            {isHelpVisible ? (
              <div className="motion-reveal mt-4 rounded-2xl border border-blue-200 bg-white p-4 text-sm leading-7 text-[var(--text)] shadow-sm">
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
              ? session?.activeCourseContext
                ? supportLevelPresentation.session.completedSupportingText
                : "سننقلك إلى خلاصة الجلسة."
              : session?.activeCourseContext
                ? supportLevelPresentation.session.continueSupportingText
                : "خطوتك محفوظة، ويمكنك المتابعة الآن."
            : session?.activeCourseContext
              ? supportLevelPresentation.session.submitSupportingText
              : "نحفظ التقدم بعد كل خطوة."
        }
      />
    </StudentShell>
  );
}
