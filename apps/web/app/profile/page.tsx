"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActiveCourseContextCard } from "@/src/components/active-course-context-card";
import { InlineReveal } from "@/src/components/inline-reveal";
import { PackProgressMemoryCard } from "@/src/components/pack-progress-memory-card";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import { ApiError, fetchTodaySummary, type ProgrammingState } from "@/src/lib/api";
import { readLearnerProfileLite } from "@/src/lib/learner-profile-lite";
import {
  getHelpKindLabel,
  getProgrammingStateTone,
  getSessionModeLabel,
  getSessionModeTone,
} from "@/src/lib/programming-ui";

function formatArabicDate(iso: string | null) {
  if (!iso) {
    return "لا توجد جلسة مكتملة بعد";
  }

  return new Intl.DateTimeFormat("ar", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function compactText(text: string) {
  return text.length > 96 ? `${text.slice(0, 93).trim()}...` : text;
}

function getProfileCourseContextCopy(today: ProgrammingState) {
  switch (today.activeCourseContext?.supportLevel) {
    case "full_coach":
      return "ملفك الآن يعرض تقدمك داخل المقرر النشط نفسه، لذلك تبقى الملاحظات الأخيرة مربوطة بالمفهوم الجاري تدريبه داخل هذا السياق.";
    case "guided_study":
      return "ملفك الآن يجمع الإشارات الأخيرة من خريطة المقرر المؤكدة ومن سلوكك الدراسي الحديث، مع لغة واضحة حول حدود الدعم.";
    case "planning_review":
      return "ملفك الآن يربط الملاحظات الأخيرة بالمقرر النشط وخطة مراجعته الحالية، حتى ترى أين يتجمع الضغط الدراسي الآن.";
    default:
      return today.rationaleText;
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const [today, setToday] = useState<ProgrammingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const payload = await fetchTodaySummary();
        if (cancelled) {
          return;
        }

        setToday(payload);
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
          setError("تعذّر تحميل ملفك الدراسي الآن.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, router]);

  const profile = useMemo(() => readLearnerProfileLite(), [refreshKey, today]);

  return (
    <StudentShell>
      <PageHeader
        eyebrow="ملفك"
        subtitle="لقطة خفيفة لحالتك الحالية وطريقة تقدّمك."
        title="ملفك الدراسي المختصر"
      />

      <section className="flex flex-1 flex-col gap-4 px-4 pb-6 md:px-6">
        {loading ? (
          <StatePanel
            description="نحضّر صورة مختصرة عن حالتك الحالية."
            eyebrow="ملفك"
            title="نحمّل الملف..."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            description={error}
            eyebrow="ملفك"
            title="تعذّر تحميل الملف."
            tone="error"
          />
        ) : null}

        {today ? (
          <>
            {today.activeCourseContext ? (
              <ActiveCourseContextCard
                activeCourseContext={today.activeCourseContext}
                description={getProfileCourseContextCopy(today)}
                eyebrow="المقرر النشط في ملفك الآن"
                focusLabel={
                  today.activeCourseContext.focusNormalizedConceptLabel ??
                  today.focusConceptLabel
                }
                linkLabel="افتح المقرر النشط"
              />
            ) : null}

            {today.activeCourseContext && today.packProgressMemory ? (
              <PackProgressMemoryCard
                compact
                courseTitle={today.activeCourseContext.courseTitle}
                currentFocusLabel={
                  today.activeCourseContext.focusNormalizedConceptLabel ??
                  today.focusConceptLabel
                }
                memory={today.packProgressMemory}
                surface="profile"
              />
            ) : null}

            <div className="motion-rise stage-card rounded-[2rem] p-5 md:p-6">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getProgrammingStateTone(today.programmingStateCode)}`}
                >
                  {today.programmingStateLabel}
                </span>
                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getSessionModeTone(today.sessionMode)}`}
                >
                  {getSessionModeLabel(today.sessionMode)}
                </span>
                {today.activeCourseContext ? (
                  <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">
                    من {today.activeCourseContext.courseTitle}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 text-xs font-semibold text-[var(--text-muted)]">
                التركيز الحالي
              </div>
              <div className="mt-2 text-[1.35rem] font-semibold leading-9 text-[var(--text)]">
                {today.focusConceptLabel}
              </div>
              <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                {compactText(today.rationaleText)}
              </div>
              <div className="mt-4">
                <InlineReveal label="لماذا هذا الآن؟" tone="accent">
                  {today.rationaleText}
                </InlineReveal>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="motion-rise-delay-1 stage-card rounded-[1.8rem] p-5">
                <div className="text-xs font-semibold text-[var(--text-muted)]">
                  أسلوب الدعم المفضّل
                </div>
                <div className="mt-2 text-base font-semibold text-[var(--text)]">
                  {profile.onboardingProfile?.preferredHelpStyle
                    ? getHelpKindLabel(profile.onboardingProfile.preferredHelpStyle)
                    : "غير محفوظ بعد"}
                </div>
                <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  النمط الحالي: {today.sessionModeLabel}
                </div>
              </div>

              <div className="motion-rise-delay-2 stage-card rounded-[1.8rem] p-5">
                <div className="text-xs font-semibold text-[var(--text-muted)]">
                  استمرارية التدريب
                </div>
                <div className="mt-2 text-base font-semibold text-[var(--text)]">
                  {profile.completedSessionIds.length} جلسة مكتملة
                </div>
                <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  آخر جلسة: {formatArabicDate(profile.lastCompletedAt)}
                </div>
              </div>
            </div>

            {profile.latestSummary ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="motion-rise-delay-1 rounded-[1.7rem] border border-green-200 bg-green-50 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-green-800">
                    {profile.latestSummary.whatImproved.label}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-green-950">
                    {compactText(
                      today.activeCourseContext
                        ? `${profile.latestSummary.whatImproved.text} داخل ${today.activeCourseContext.courseTitle}.`
                        : profile.latestSummary.whatImproved.text,
                    )}
                  </div>
                </div>

                <div className="motion-rise-delay-2 rounded-[1.7rem] border border-blue-200 bg-blue-50 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-blue-800">
                    {profile.latestSummary.whatNeedsSupport.label}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-blue-950">
                    {compactText(
                      today.activeCourseContext
                        ? `${profile.latestSummary.whatNeedsSupport.text} داخل ${today.activeCourseContext.courseTitle}.`
                        : profile.latestSummary.whatNeedsSupport.text,
                    )}
                  </div>
                </div>

                <div className="motion-rise-delay-3 rounded-[1.7rem] border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-700">
                    {profile.latestSummary.studyPatternObserved.label}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-slate-900">
                    {compactText(profile.latestSummary.studyPatternObserved.text)}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="motion-rise-delay-2 stage-card rounded-[1.85rem] p-5">
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                لمحة النشاط الأخير
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.recentModes.length > 0 ? (
                  profile.recentModes.map((item) => (
                    <span
                      key={`${item.mode}-${item.recordedAt}`}
                      className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getSessionModeTone(item.mode)}`}
                    >
                      {getSessionModeLabel(item.mode)}
                    </span>
                  ))
                ) : (
                  <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] shadow-sm">
                    لا يوجد سجل كافٍ بعد
                  </span>
                )}
              </div>

              {profile.latestSummary ? (
                <div className="mt-4 rounded-[1.4rem] border border-[var(--border)] bg-white/80 p-4 text-sm leading-7 text-[var(--text)] shadow-sm">
                  آخر مساحة احتجت دعمًا:{" "}
                  {today.activeCourseContext
                    ? `${profile.latestSummary.whatNeedsSupport.text} داخل ${today.activeCourseContext.courseTitle}.`
                    : profile.latestSummary.whatNeedsSupport.text}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </section>

      <StickyActionBar
        disabled={!today}
        label="العودة إلى حالتك اليوم"
        onClick={() => router.replace("/today")}
        supportingText={
          today ? today.nextStepText : "سنعود إلى خطوتك التالية."
        }
      />
    </StudentShell>
  );
}
