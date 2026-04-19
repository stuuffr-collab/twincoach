"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ActiveCourseContextCard } from "@/src/components/active-course-context-card";
import { InlineReveal } from "@/src/components/inline-reveal";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import { ApiError, fetchSessionSummary, type SessionSummary } from "@/src/lib/api";
import {
  getRefreshFollowThroughPresentation,
  getRefreshPresentation,
  getRefreshResolutionPresentation,
} from "@/src/lib/course-pack-refresh-presentation";
import { getRecurringFocusPresentation } from "@/src/lib/course-pack-recurring-presentation";
import { getSessionModeLabel, getSessionModeTone } from "@/src/lib/programming-ui";
import { getSupportLevelPresentation } from "@/src/lib/support-level-presentation";

function shortenCopy(text: string) {
  return text.length > 105 ? `${text.slice(0, 102).trim()}...` : text;
}

function getSummaryCourseContextCopy(summary: SessionSummary) {
  switch (summary.activeCourseContext?.supportLevel) {
    case "full_coach":
      return "هذه الخلاصة مرتبطة بالمقرر النشط وبالمفهوم الذي دخل الجلسة من سياقك الدراسي المؤكد، لا من مسار عام منفصل.";
    case "guided_study":
      return "هذه الخلاصة تقرأ تقدمك داخل مقررك النشط مع لغة واضحة حول أن الدعم هنا موجه بحسب المواد المؤكدة، لا بحسب افتراضات أوسع.";
    case "planning_review":
      return "هذه الخلاصة تعود إلى الأولوية الحالية التي ظهرت في خريطة المقرر المؤكدة، حتى تبقى المراجعة مرتبطة بما يحتاجه هذا المقرر الآن.";
    default:
      return "هذه الخلاصة مرتبطة بجلسة اليوم وما أظهرته من خطوة دعم تالية.";
  }
}

export default function SessionSummaryPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : params.sessionId;

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const payload = await fetchSessionSummary(sessionId);

        if (!cancelled) {
          setSummary(payload);
        }
      } catch (loadError) {
        if (
          loadError instanceof ApiError &&
          loadError.message === "Session incomplete"
        ) {
          router.replace(`/session/${sessionId}`);
          return;
        }

        if (!cancelled) {
          setError("تعذر تحميل خلاصة هذه الجلسة الآن.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (sessionId) {
      void loadSummary();
    }

    return () => {
      cancelled = true;
    };
  }, [router, sessionId]);

  const summaryCards = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      {
        key: "improved",
        label: summary.whatImproved.label,
        text: shortenCopy(summary.whatImproved.text),
        fullText: summary.whatImproved.text,
        className: "border-green-200 bg-green-50",
      },
      {
        key: "support",
        label: summary.whatNeedsSupport.label,
        text: shortenCopy(summary.whatNeedsSupport.text),
        fullText: summary.whatNeedsSupport.text,
        className: "border-blue-200 bg-blue-50",
      },
      {
        key: "pattern",
        label: summary.studyPatternObserved.label,
        text: shortenCopy(summary.studyPatternObserved.text),
        fullText: summary.studyPatternObserved.text,
        className: "border-slate-200 bg-slate-50",
      },
    ];
  }, [summary]);

  const supportLevelPresentation = getSupportLevelPresentation(
    summary?.activeCourseContext?.supportLevel ?? null,
  );
  const refreshPresentation = useMemo(() => {
    if (
      !summary?.activeCourseContext ||
      !summary.refreshHandoff?.isFirstSessionAfterRefresh
    ) {
      return null;
    }

    return getRefreshPresentation("summary", {
      courseTitle: summary.activeCourseContext.courseTitle,
      focusLabel:
        summary.activeCourseContext.focusNormalizedConceptLabel ??
        summary.focusConceptLabel,
      refreshContext: summary.refreshHandoff,
    });
  }, [summary]);
  const resolutionPresentation = useMemo(() => {
    if (!summary?.activeCourseContext?.resolution || !summary.refreshHandoff) {
      return null;
    }

    return getRefreshResolutionPresentation("summary", {
      courseTitle: summary.activeCourseContext.courseTitle,
      focusLabel:
        summary.activeCourseContext.focusNormalizedConceptLabel ??
        summary.focusConceptLabel,
      resolution: summary.activeCourseContext.resolution,
    });
  }, [summary]);
  const followThroughPresentation = useMemo(() => {
    if (!summary?.refreshHandoff?.isFollowThroughSession || resolutionPresentation) {
      return null;
    }

    return getRefreshFollowThroughPresentation("summary", {
      courseTitle: summary.activeCourseContext?.courseTitle ?? "",
      focusLabel:
        summary.activeCourseContext?.followThrough?.targetLabel ??
        summary.activeCourseContext?.focusNormalizedConceptLabel ??
        summary.focusConceptLabel,
      followThrough:
        summary.activeCourseContext?.followThrough ?? {
          targetNormalizedConceptId:
            summary.focusCompiledConceptId ?? "refresh-follow-through",
          targetLabel: summary.focusConceptLabel,
          reasonType: summary.refreshHandoff.reasonType,
        },
      willContinueAfterSession: Boolean(summary.activeCourseContext?.followThrough),
    });
  }, [resolutionPresentation, summary]);
  const recurringPresentation = useMemo(() => {
    if (
      !summary?.activeCourseContext ||
      !summary.recurringFocusDecision ||
      refreshPresentation ||
      followThroughPresentation ||
      resolutionPresentation
    ) {
      return null;
    }

    return getRecurringFocusPresentation("summary", {
      courseTitle: summary.activeCourseContext.courseTitle,
      decision: summary.recurringFocusDecision,
    });
  }, [
    followThroughPresentation,
    refreshPresentation,
    resolutionPresentation,
    summary,
  ]);

  return (
    <StudentShell>
      <PageHeader
        eyebrow="خلاصة الجلسة"
        subtitle="ما تحسّن، وما يحتاج دعمًا، وما سنبني عليه بعد ذلك."
        title="خرجنا من الجلسة بصورة أوضح"
      />

      <section className="flex flex-1 flex-col gap-4 px-4 pb-6 md:px-6">
        {loading ? (
          <StatePanel
            description="نحضر الخلاصة المحفوظة للجلسة."
            eyebrow="خلاصة الجلسة"
            title="نجهز الملخص..."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            description={error}
            eyebrow="خلاصة الجلسة"
            title="تعذر تحميل الخلاصة."
            tone="error"
          />
        ) : null}

        {summary ? (
          <>
            {resolutionPresentation ? (
              <div className="space-y-3">
                <StatePanel
                  description={resolutionPresentation.description}
                  eyebrow="خاتمة متابعة التحديث"
                  title={resolutionPresentation.title}
                  tone="recovery"
                />
                <div className="rounded-[1.4rem] border border-blue-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm">
                      {resolutionPresentation.reasonChip}
                    </span>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm">
                      العودة إلى الإيقاع الطبيعي
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                    {resolutionPresentation.supportingText}
                  </div>
                </div>
              </div>
            ) : refreshPresentation ? (
              <div className="space-y-3">
                <StatePanel
                  description={refreshPresentation.description}
                  eyebrow="استمرارية بعد تحديث المقرر"
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
                  eyebrow="استمرارية بعد خطوة المتابعة"
                  title={followThroughPresentation.title}
                  tone="recovery"
                />
                <div className="rounded-[1.4rem] border border-blue-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm">
                      {followThroughPresentation.reasonChip}
                    </span>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm">
                      جلسة متابعة بعد التحديث
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                    {followThroughPresentation.supportingText}
                  </div>
                </div>
              </div>
            ) : recurringPresentation ? (
              <div className="space-y-3">
                <StatePanel
                  description={recurringPresentation.description}
                  eyebrow="استمرارية القرار التالي"
                  title={recurringPresentation.title}
                  tone="recovery"
                />
                <div className="rounded-[1.4rem] border border-blue-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm">
                      {recurringPresentation.reasonChip}
                    </span>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm">
                      {summary.recurringFocusDecision?.nextStepIntent === "stay"
                        ? "قد نبقى قريبًا من هذا الجزء"
                        : "يمكننا التحرك بعده"}
                    </span>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                    {recurringPresentation.supportingText}
                  </div>
                </div>
              </div>
            ) : null}

            {summary.activeCourseContext ? (
              <ActiveCourseContextCard
                activeCourseContext={summary.activeCourseContext}
                description={getSummaryCourseContextCopy(summary)}
                eyebrow="ملخص الجلسة داخل المقرر النشط"
                focusLabel={
                  summary.activeCourseContext.focusNormalizedConceptLabel ??
                  summary.focusConceptLabel
                }
                linkLabel="راجع خريطة المقرر"
              />
            ) : null}

            <div className="motion-rise stage-card rounded-[2rem] p-5 md:p-6">
              <div className="flex flex-wrap gap-2">
                {summary.sessionMode ? (
                  <span
                    className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getSessionModeTone(summary.sessionMode)}`}
                  >
                    {getSessionModeLabel(summary.sessionMode)}
                  </span>
                ) : null}
                {summary.focusConceptLabel ? (
                  <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">
                    التركيز: {summary.focusConceptLabel}
                  </span>
                ) : null}
                {summary.activeCourseContext ? (
                  <span className="support-chip">
                    أولوية حالية من خريطة المقرر المؤكدة
                  </span>
                ) : (
                  <span className="support-chip">
                    الخلاصة مبنية على هذه الجلسة فقط
                  </span>
                )}
              </div>

              <div className="mt-5 text-lg font-semibold leading-8 text-[var(--text)]">
                {summary.activeCourseContext
                  ? supportLevelPresentation.summary.heroText
                  : "فهمنا ما الذي تحسن، وما الذي ما زال يحتاج خطوة دعم واحدة."}
              </div>

              {summary.activeCourseContext ? (
                <div className="mt-4 rounded-[1.4rem] border border-[var(--border)] bg-white/82 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                    كيف نقرأ هذه الخلاصة؟
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[var(--text)]">
                    {supportLevelPresentation.summary.interpretationText}
                  </div>
                </div>
              ) : null}
            </div>

            {summary.activeCourseContext ? (
              <div className="motion-rise-delay-1 stage-card rounded-[1.8rem] p-5">
                <div className="text-xs font-semibold text-[var(--text-muted)]">
                  الخطوة التالية في هذا الوضع
                </div>
                <div className="mt-2 text-sm leading-7 text-[var(--text)]">
                  {resolutionPresentation
                    ? resolutionPresentation.supportingText
                    : summary.refreshHandoff?.isFollowThroughSession
                    ? followThroughPresentation?.supportingText ??
                      supportLevelPresentation.summary.nextStepLead
                    : summary.refreshHandoff?.isFirstSessionAfterRefresh
                    ? refreshPresentation?.supportingText ??
                      supportLevelPresentation.summary.nextStepLead
                    : supportLevelPresentation.summary.nextStepLead}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-3">
              {summaryCards.map((card, index) => (
                <div
                  key={card.key}
                  className={`rounded-[1.7rem] border p-4 shadow-sm ${
                    index === 0
                      ? "motion-rise-delay-1"
                      : index === 1
                        ? "motion-rise-delay-2"
                        : "motion-rise-delay-3"
                  } ${card.className}`}
                >
                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                    {card.label}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[var(--text)]">
                    {card.text}
                  </div>
                </div>
              ))}
            </div>

            <InlineReveal label="تفاصيل الجلسة" tone="soft">
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                    {summary.whatImproved.label}
                  </div>
                  <div className="mt-1 text-sm leading-7 text-[var(--text)]">
                    {summary.whatImproved.text}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                    {summary.whatNeedsSupport.label}
                  </div>
                  <div className="mt-1 text-sm leading-7 text-[var(--text)]">
                    {summary.whatNeedsSupport.text}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                    {summary.studyPatternObserved.label}
                  </div>
                  <div className="mt-1 text-sm leading-7 text-[var(--text)]">
                    {summary.studyPatternObserved.text}
                  </div>
                </div>
              </div>
            </InlineReveal>

            <div className="motion-rise-delay-2 stage-card rounded-[1.8rem] p-5">
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                الخطوة التالية
              </div>
              <div className="mt-2 text-sm leading-7 text-[var(--text)]">
                {summary.nextBestAction.text}
              </div>
            </div>

            <div className="motion-rise-delay-3 rounded-[1.6rem] border border-[var(--border)] bg-white/80 p-4 shadow-sm">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                    {supportLevelPresentation.summary.completedLabel}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[var(--text)]">
                    {summary.completedTaskCount}
                  </div>
                </div>
                <div className="rounded-2xl bg-green-50 p-3">
                  <div className="text-xs font-semibold text-green-700">
                    {supportLevelPresentation.summary.positiveLabel}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-green-900">
                    {summary.correctCount}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-600">
                    {supportLevelPresentation.summary.reviewLabel}
                  </div>
                  <div className="mt-1 text-lg font-semibold text-slate-900">
                    {summary.incorrectCount}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <StickyActionBar
        disabled={!summary}
        label={summary?.nextBestAction.label ?? "العودة إلى حالتك البرمجية اليوم"}
        onClick={() => router.replace(summary?.nextBestAction.route ?? "/today")}
        supportingText={
          summary?.activeCourseContext
            ? supportLevelPresentation.summary.stickySupportingText
            : "الخلاصة محفوظة، والخطوة التالية جاهزة."
        }
      />
    </StudentShell>
  );
}
