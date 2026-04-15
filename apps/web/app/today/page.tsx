"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { InlineReveal } from "@/src/components/inline-reveal";
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
  getProgrammingStateLabel,
  getProgrammingStateTone,
  getSessionModeLabel,
  getSessionModeTone,
} from "@/src/lib/programming-ui";

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

export default function TodayPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<ProgrammingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadToday() {
      try {
        const payload = await fetchTodaySummary();
        if (cancelled) {
          return;
        }

        setSummary(payload);
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
          setError("تعذّر تحميل حالتك البرمجية الآن.");
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
      if (actionError instanceof ApiError && actionError.message === "Diagnostic incomplete") {
        router.replace("/diagnostic");
        return;
      }

      setError("تعذّر فتح تدريب اليوم الآن.");
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
            description="نحضّر الإشارة الحالية والخطوة الأنسب لك."
            eyebrow="حالتك البرمجية"
            title="نجهّز قراءة اليوم..."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            description={error}
            eyebrow="حالتك البرمجية"
            title="تعذّر تحميل خطة اليوم."
            tone="error"
          />
        ) : null}

        {summary ? (
          <>
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
                <span className="support-chip">{getProgrammingStateSupport(summary)}</span>
              </div>

              <div className="mt-5 text-xs font-semibold text-[var(--text-muted)]">
                ما الذي نفهمه الآن؟
              </div>
              <div className="mt-2 text-[1.35rem] font-semibold leading-9 text-[var(--text)] md:text-[1.55rem]">
                نركّز الآن على {summary.focusConceptLabel}
              </div>
              <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{rationale}</div>

              <div className="mt-4">
                <InlineReveal label="لماذا الآن؟" tone="accent">
                  {summary.rationaleText}
                </InlineReveal>
              </div>
            </div>

            <div className="motion-rise-delay-1 stage-card rounded-[2rem] p-5 md:p-6">
              <div className="text-xs font-semibold text-[var(--text-muted)]">
                الخطوة التالية
              </div>
              <div className="mt-2 text-lg font-semibold leading-8 text-[var(--text)]">
                {summary.nextStepText}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--text)] shadow-sm">
                  {summary.hasActiveDailySession ? "عودة من نفس المكان" : "جلسة قصيرة"}
                </span>
                <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--text)] shadow-sm">
                  {summary.primaryActionLabel}
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
            ? "نفتح تدريب اليوم..."
            : summary?.primaryActionLabel ?? "ابدأ تدريب اليوم"
        }
        onClick={handlePrimaryAction}
        supportingText={
          summary ? getProgrammingStateSupport(summary) : "ستظهر هنا أفضل خطوة تالية."
        }
      />
    </StudentShell>
  );
}
