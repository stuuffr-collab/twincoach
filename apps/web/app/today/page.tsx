"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import {
  ApiError,
  createOrResumeDailySession,
  fetchTodaySummary,
  type TodaySummary,
} from "@/src/lib/api";

function getReadinessTone(readinessBand: string) {
  if (readinessBand === "Needs Review") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  if (readinessBand === "Building Readiness") {
    return "border-blue-200 bg-blue-50 text-blue-900";
  }

  return "border-slate-200 bg-slate-50 text-slate-900";
}

function getReadinessCopy(readinessBand: string) {
  if (readinessBand === "Needs Review") {
    return {
      explanation:
        "You still have weak areas or due review that need to be cleared before this signal can improve.",
      nextStep: "Complete today's short session and clear the due review items first.",
    };
  }

  if (readinessBand === "Building Readiness") {
    return {
      explanation:
        "You have enough evidence to show progress, but the signal stays conservative until coverage stays stable.",
      nextStep: "Keep finishing daily sessions and protect your review work across topics.",
    };
  }

  return {
    explanation:
      "You have not answered enough across the exam scope to support a stronger readiness signal yet.",
    nextStep: "Keep completing short sessions so we can confirm weak areas before the exam.",
  };
}

function getPrimaryActionCopy(summary: TodaySummary) {
  if (summary.hasActiveDailySession) {
    return {
      label: "Resume today's session",
      support: "Pick up right where you left off.",
    };
  }

  return {
    label: "Start today's session",
    support: "One short session moves today's plan forward.",
  };
}

export default function TodayPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<TodaySummary | null>(null);
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
          setError("Unable to load today.");
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

      setError("Unable to start your daily session.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <StudentShell>
      <PageHeader
        detail="One short session today keeps your exam plan moving."
        eyebrow="Today's plan"
        subtitle="A calm view of your current readiness and the next study step."
        title="Keep your exam plan moving"
      />
      <section className="flex flex-1 flex-col gap-4 px-4 pb-6">
        {loading ? (
          <StatePanel
            description="We're loading today's readiness signal and your next study step."
            eyebrow="Today's plan"
            title="Loading your plan for today..."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            description={error}
            eyebrow="Today's plan"
            title="We couldn't load today's plan."
            tone="error"
          />
        ) : null}

        {summary ? (
          <>
            {(() => {
              const readinessCopy = getReadinessCopy(summary.readinessBand);
              const readinessTone = getReadinessTone(summary.readinessBand);
              const actionCopy = getPrimaryActionCopy(summary);

              return (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Exam date
                      </div>
                      <div className="mt-2 text-base font-semibold text-[var(--text)]">
                        {summary.examDate}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Time left
                      </div>
                      <div className="mt-2 text-base font-semibold text-[var(--text)]">
                        {summary.daysToExam} days
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Readiness
                    </div>
                    <div
                      className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${readinessTone}`}
                    >
                      {summary.readinessBand}
                    </div>
                    <div className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                      {readinessCopy.explanation}
                    </div>

                    <div className="mt-5 rounded-2xl bg-[var(--surface-muted)] p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                        Do this now
                      </div>
                      <div className="mt-2 text-base font-semibold text-[var(--text)]">
                        {actionCopy.label}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                        {readinessCopy.nextStep}
                      </div>
                    </div>

                    <div className="mt-4 text-sm text-[var(--text-muted)]">
                      {actionCopy.support}
                    </div>
                  </div>
                </>
              );
            })()}
          </>
        ) : null}
      </section>
      <StickyActionBar
        disabled={loading || isStarting || !summary}
        label={
          isStarting
            ? "Starting..."
            : summary
              ? getPrimaryActionCopy(summary).label
              : "Start today's session"
        }
        onClick={handlePrimaryAction}
        supportingText={
          summary
            ? getPrimaryActionCopy(summary).support
            : "Your next study step appears here as soon as your plan loads."
        }
      />
    </StudentShell>
  );
}
