"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { InlineReveal } from "@/src/components/inline-reveal";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import { ApiError, fetchSessionSummary, type SessionSummary } from "@/src/lib/api";
import { getSessionModeLabel, getSessionModeTone } from "@/src/lib/programming-ui";

function shortenCopy(text: string) {
  return text.length > 105 ? `${text.slice(0, 102).trim()}...` : text;
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
        if (cancelled) {
          return;
        }

        setSummary(payload);
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.message === "Session incomplete") {
          router.replace(`/session/${sessionId}`);
          return;
        }

        if (!cancelled) {
          setError("تعذّر تحميل خلاصة هذه الجلسة الآن.");
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
            description="نحضّر الخلاصة المحفوظة للجلسة."
            eyebrow="خلاصة الجلسة"
            title="نجهّز الملخّص..."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            description={error}
            eyebrow="خلاصة الجلسة"
            title="تعذّر تحميل الخلاصة."
            tone="error"
          />
        ) : null}

        {summary ? (
          <>
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
                <span className="support-chip">الخلاصة مبنية على هذه الجلسة فقط</span>
              </div>

              <div className="mt-5 text-lg font-semibold leading-8 text-[var(--text)]">
                فهمنا ما الذي تحسّن، وما الذي ما زال يحتاج خطوة دعم واحدة.
              </div>
            </div>

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
                  <div className="mt-2 text-sm leading-7 text-[var(--text)]">{card.text}</div>
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
                  <div className="text-xs font-semibold text-[var(--text-muted)]">مكتمل</div>
                  <div className="mt-1 text-lg font-semibold text-[var(--text)]">
                    {summary.completedTaskCount}
                  </div>
                </div>
                <div className="rounded-2xl bg-green-50 p-3">
                  <div className="text-xs font-semibold text-green-700">موفّق</div>
                  <div className="mt-1 text-lg font-semibold text-green-900">
                    {summary.correctCount}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-600">للمراجعة</div>
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
        supportingText="الخلاصة محفوظة، والخطوة التالية جاهزة."
      />
    </StudentShell>
  );
}
