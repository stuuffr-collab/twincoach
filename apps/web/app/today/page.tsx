"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ActiveCourseContextCard } from "@/src/components/active-course-context-card";
import { InlineReveal } from "@/src/components/inline-reveal";
import { PackProgressMemoryCard } from "@/src/components/pack-progress-memory-card";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import {
  ApiError,
  createOrResumeDailySession,
  fetchTodaySummary,
  type ProgrammingState,
} from "@/src/lib/api";
import {
  getRefreshFollowThroughPresentation,
  getRefreshPresentation,
  getRefreshResolutionPresentation,
} from "@/src/lib/course-pack-refresh-presentation";
import { getRecurringFocusPresentation } from "@/src/lib/course-pack-recurring-presentation";
import {
  getProgrammingStateLabel,
  getProgrammingStateTone,
  getSessionModeLabel,
  getSessionModeTone,
} from "@/src/lib/programming-ui";
import { getSupportLevelPresentation } from "@/src/lib/support-level-presentation";

function getProgrammingStateSupport(summary: ProgrammingState) {
  if (summary.hasActiveDailySession) {
    return "سنفتح لك الجلسة من آخر خطوة محفوظة.";
  }

  return "جلسة قصيرة وواضحة تكفي لتثبيت الاتجاه التالي.";
}

function getShortRationale(summary: ProgrammingState) {
  return summary.rationaleText.length > 110
    ? `${summary.rationaleText.slice(0, 107).trim()}...`
    : summary.rationaleText;
}

function getTodayCourseContextCopy(summary: ProgrammingState) {
  switch (summary.activeCourseContext?.supportLevel) {
    case "full_coach":
      return `تدريب اليوم مبني على مقررك المؤكد، وهذا التركيز هو أقرب نقطة يحتاجها تقدمك الآن داخل ${summary.activeCourseContext.courseTitle}.`;
    case "guided_study":
      return `خطوة اليوم موجهة من خريطة ${summary.activeCourseContext.courseTitle} المؤكدة، مع دعم واضح وصريح من دون ادعاء تقييم أعمق مما تسمح به المواد.`;
    case "planning_review":
      return `خطوة اليوم تأتي من خطة المراجعة المؤكدة لهذا المقرر، حتى يبقى تركيزك على الأولوية الحالية بدل التشتت بين ملفاتك.`;
    default:
      return summary.rationaleText;
  }
}

export default function TodayPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<ProgrammingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const [coursePackRefreshed, setCoursePackRefreshed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadToday() {
      try {
        const payload = await fetchTodaySummary();

        if (!cancelled) {
          setSummary(payload);
        }
      } catch (loadError) {
        if (loadError instanceof ApiError) {
          if (loadError.message === "Diagnostic incomplete") {
            router.replace("/diagnostic");
            return;
          }

          if (loadError.message === "Onboarding incomplete") {
            router.replace("/onboarding");
            return;
          }
        }

        if (!cancelled) {
          setError("تعذر تحميل حالتك البرمجية الآن.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadToday();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setCoursePackRefreshed(params.get("coursePackRefreshed") === "1");
  }, []);

  async function handlePrimaryAction() {
    if (isStarting) {
      return;
    }

    setIsStarting(true);
    setError("");

    try {
      const session = await createOrResumeDailySession();
      router.replace(`/session/${session.sessionId}`);
    } catch (actionError) {
      if (
        actionError instanceof ApiError &&
        actionError.message === "Diagnostic incomplete"
      ) {
        router.replace("/diagnostic");
        return;
      }

      setError("تعذر فتح تدريب اليوم الآن.");
    } finally {
      setIsStarting(false);
    }
  }

  const rationale = useMemo(() => {
    if (!summary) {
      return "";
    }

    return getShortRationale(summary);
  }, [summary]);

  const supportLevelPresentation = useMemo(() => {
    return getSupportLevelPresentation(
      summary?.activeCourseContext?.supportLevel ?? null,
      {
        hasActiveSession: summary?.hasActiveDailySession ?? false,
      },
    );
  }, [summary]);

  const refreshPresentation = useMemo(() => {
    if (!coursePackRefreshed || !summary?.activeCourseContext?.refreshContext) {
      return null;
    }

    return getRefreshPresentation("today", {
      courseTitle: summary.activeCourseContext.courseTitle,
      focusLabel:
        summary.activeCourseContext.focusNormalizedConceptLabel ??
        summary.focusConceptLabel,
      refreshContext: summary.activeCourseContext.refreshContext,
    });
  }, [coursePackRefreshed, summary]);
  const followThroughPresentation = useMemo(() => {
    if (!summary?.activeCourseContext?.followThrough) {
      return null;
    }

    return getRefreshFollowThroughPresentation("today", {
      courseTitle: summary.activeCourseContext.courseTitle,
      focusLabel:
        summary.activeCourseContext.followThrough.targetLabel ??
        summary.activeCourseContext.focusNormalizedConceptLabel ??
        summary.focusConceptLabel,
      followThrough: summary.activeCourseContext.followThrough,
    });
  }, [summary]);
  const resolutionPresentation = useMemo(() => {
    if (!summary?.activeCourseContext?.resolution) {
      return null;
    }

    return getRefreshResolutionPresentation("today", {
      courseTitle: summary.activeCourseContext.courseTitle,
      focusLabel:
        summary.activeCourseContext.focusNormalizedConceptLabel ??
        summary.focusConceptLabel,
      resolution: summary.activeCourseContext.resolution,
    });
  }, [summary]);
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

    return getRecurringFocusPresentation("today", {
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
        eyebrow="حالتك اليوم"
        subtitle="إشارة واحدة واضحة، وخطوة تدريبية واحدة فقط."
        title={summary?.screenTitle ?? "حالتك البرمجية اليوم"}
      />

      <section className="flex flex-1 flex-col gap-4 px-4 pb-6 md:px-6">
        {loading ? (
          <StatePanel
            description="نحضر الإشارة الحالية والخطوة الأنسب لك."
            eyebrow="حالتك البرمجية"
            title="نجهز قراءة اليوم..."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            description={error}
            eyebrow="حالتك البرمجية"
            title="تعذر تحميل خطة اليوم."
            tone="error"
          />
        ) : null}

        {summary ? (
          <>
            {refreshPresentation ? (
              <div className="space-y-3">
                <StatePanel
                  description={refreshPresentation.description}
                  eyebrow="تحديث بعد المراجعة"
                  title={refreshPresentation.title}
                  tone="recovery"
                />

                <div className="rounded-[1.4rem] border border-blue-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm">
                      {refreshPresentation.reasonChip}
                    </span>
                    {summary.activeCourseContext?.refreshContext?.firstSessionPending ? (
                      <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm">
                        أول خطوة بعد التحديث
                      </span>
                    ) : null}
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
                  eyebrow="Ù…ØªØ§Ø¨Ø¹Ø© Ø¨Ø¹Ø¯ Ø§Ù„ØªØ­Ø¯ÙŠØ«"
                  title={followThroughPresentation.title}
                  tone="recovery"
                />

                <div className="rounded-[1.4rem] border border-blue-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm">
                      {followThroughPresentation.reasonChip}
                    </span>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm">
                      Ø®Ø·ÙˆØ© Ù…ØªØ§Ø¨Ø¹Ø© ÙˆØ§Ø­Ø¯Ø©
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
                  eyebrow="العودة إلى المسار الطبيعي"
                  title={resolutionPresentation.title}
                  tone="recovery"
                />

                <div className="rounded-[1.4rem] border border-blue-200 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm">
                      {resolutionPresentation.reasonChip}
                    </span>
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text)] shadow-sm">
                      خطوة عودة هادئة
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
                  eyebrow="استمرارية التركيز"
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
                        ? "نبقى مع هذا الجزء"
                        : "ننتقل بهدوء إلى التالي"}
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
                description={getTodayCourseContextCopy(summary)}
                eyebrow="السياق النشط الآن"
                focusLabel={
                  summary.activeCourseContext.focusNormalizedConceptLabel ??
                  summary.focusConceptLabel
                }
                linkLabel="راجع هذا المقرر"
              />
            ) : null}

            {summary.activeCourseContext && summary.packProgressMemory ? (
              <PackProgressMemoryCard
                courseTitle={summary.activeCourseContext.courseTitle}
                currentFocusLabel={
                  summary.activeCourseContext.focusNormalizedConceptLabel ??
                  summary.focusConceptLabel
                }
                memory={summary.packProgressMemory}
                surface="today"
              />
            ) : null}

            <div className="motion-rise stage-card rounded-[2rem] p-5 md:p-6">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getProgrammingStateTone(summary.programmingStateCode)}`}
                >
                  {getProgrammingStateLabel(summary.programmingStateCode)}
                </span>
                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getSessionModeTone(summary.sessionMode)}`}
                >
                  {getSessionModeLabel(summary.sessionMode)}
                </span>
                {summary.activeCourseContext ? (
                  <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">
                    من {summary.activeCourseContext.courseTitle}
                  </span>
                ) : null}
                <span className="support-chip">
                  {summary.activeCourseContext
                    ? supportLevelPresentation.today.supportChip
                    : getProgrammingStateSupport(summary)}
                </span>
              </div>

              <div className="mt-5 text-xs font-semibold text-[var(--text-muted)]">
                ماذا نفهم الآن؟
              </div>
              <div className="mt-2 text-[1.35rem] font-semibold leading-9 text-[var(--text)] md:text-[1.55rem]">
                نركز الآن على {summary.focusConceptLabel}
              </div>
              <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                {rationale}
              </div>

              {summary.activeCourseContext ? (
                <div className="mt-4 rounded-[1.4rem] border border-[var(--border)] bg-white/82 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-[var(--text-muted)]">
                    ماذا تتوقع من هذه الخطوة؟
                  </div>
                  <div className="mt-2 text-sm leading-7 text-[var(--text)]">
                    {supportLevelPresentation.today.nextStepLead}
                  </div>
                </div>
              ) : null}

              <div className="mt-4">
                <InlineReveal label="لماذا الآن؟" tone="accent">
                  {summary.rationaleText}
                </InlineReveal>
              </div>

              {summary.activeCourseContext ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/92 px-3.5 py-2 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    href={`/course-pack/${summary.activeCourseContext.coursePackId}`}
                  >
                    <span className="text-[var(--primary)]">●</span>
                    افتح المقرر النشط
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="motion-rise-delay-1 stage-card rounded-[2rem] p-5 md:p-6">
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                الخطوة التالية
              </div>
              <div className="mt-2 text-lg font-semibold leading-8 text-[var(--text)]">
                {summary.activeCourseContext
                  ? supportLevelPresentation.today.nextStepLead
                  : summary.nextStepText}
              </div>
              <div className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                {summary.nextStepText}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--text)] shadow-sm">
                  {summary.hasActiveDailySession ? "عودة من نفس المكان" : "جلسة قصيرة"}
                </span>
                <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--text)] shadow-sm">
                  {summary.activeCourseContext
                    ? supportLevelPresentation.today.primaryActionLabel
                    : summary.primaryActionLabel}
                </span>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <StickyActionBar
        disabled={loading || isStarting || !summary}
        label={
          isStarting
            ? `${supportLevelPresentation.today.primaryActionLabel}...`
            : summary?.activeCourseContext
              ? supportLevelPresentation.today.primaryActionLabel
              : summary?.primaryActionLabel ?? "ابدأ تدريب اليوم"
        }
        onClick={handlePrimaryAction}
        supportingText={
          summary
            ? summary.activeCourseContext
              ? supportLevelPresentation.today.primaryActionSupportingText
              : getProgrammingStateSupport(summary)
            : "ستظهر هنا أفضل خطوة تالية."
        }
      />
    </StudentShell>
  );
}
