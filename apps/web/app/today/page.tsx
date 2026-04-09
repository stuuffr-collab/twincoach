"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/src/components/page-header";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import {
  ApiError,
  createOrResumeDailySession,
  fetchTodaySummary,
  type TodaySummary,
} from "@/src/lib/api";

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
        title="Today"
        subtitle="Your diagnostic is complete. Here is your next study state."
      />
      <section className="flex flex-1 flex-col gap-4 px-4 pb-6">
        {loading ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
            Loading your today plan...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {summary ? (
          <>
            {(() => {
              const readinessCopy = getReadinessCopy(summary.readinessBand);

              return (
                <>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      Exam date
                    </div>
                    <div className="mt-2 text-base font-semibold text-[var(--text)]">
                      {summary.examDate}
                    </div>
                    <div className="mt-2 text-sm text-[var(--text-muted)]">
                      {summary.daysToExam} days to exam
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      Readiness
                    </div>
                    <div className="mt-2 text-base font-semibold text-[var(--text)]">
                      {summary.readinessBand}
                    </div>
                    <div className="mt-2 text-sm text-[var(--text-muted)]">
                      {readinessCopy.explanation}
                    </div>
                    <div className="mt-3 rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text)]">
                      Next step: {readinessCopy.nextStep}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      Next action
                    </div>
                    <div className="mt-2 text-base font-semibold text-[var(--text)]">
                      {summary.primaryActionLabel}
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
              ? summary.primaryActionLabel
              : "Start 10-Min Session"
        }
        onClick={handlePrimaryAction}
      />
    </StudentShell>
  );
}
