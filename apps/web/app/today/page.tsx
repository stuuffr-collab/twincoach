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
  type ProgrammingState,
} from "@/src/lib/api";
import {
  getProgrammingStateTone,
  getSessionModeTone,
} from "@/src/lib/programming-ui";

function getProgrammingStateSupport(summary: ProgrammingState) {
  if (summary.hasActiveDailySession) {
    return "Resume the saved session to keep your current progress and continue from the right step.";
  }

  return "Start one short guided session to move this programming state forward today.";
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
          setError("Unable to load your programming state.");
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

      setError("Unable to open today's programming session.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <StudentShell>
      <PageHeader
        detail="TwinCoach chooses one calm next step from your recent programming work and keeps the guidance conservative."
        eyebrow="Today's plan"
        subtitle="A simple view of what your recent Python work suggests and what kind of session should come next."
        title={summary?.screenTitle ?? "Your Programming State"}
      />
      <section className="flex flex-1 flex-col gap-4 px-4 pb-6">
        {loading ? (
          <StatePanel
            description="We're loading your current programming state and today's recommended session mode."
            eyebrow="Programming state"
            title="Loading your next study step..."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            description={error}
            eyebrow="Programming state"
            title="We couldn't load today's plan."
            tone="error"
          />
        ) : null}

        {summary ? (
          <>
            <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                What we see today
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getProgrammingStateTone(summary.programmingStateCode)}`}
                >
                  {summary.programmingStateLabel}
                </span>
                <span
                  className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getSessionModeTone(summary.sessionMode)}`}
                >
                  {summary.sessionModeLabel}
                </span>
              </div>
              <div className="mt-5 rounded-2xl bg-[var(--surface-muted)] p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  Focus concept
                </div>
                <div className="mt-2 text-lg font-semibold text-[var(--text)]">
                  {summary.focusConceptLabel}
                </div>
              </div>
              <div className="mt-4 text-sm leading-6 text-[var(--text-muted)]">
                {summary.rationaleText}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Do this next
              </div>
              <div className="mt-3 text-lg font-semibold text-[var(--text)]">
                {summary.primaryActionLabel}
              </div>
              <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                {summary.nextStepText}
              </div>
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4 text-sm leading-6 text-[var(--text-muted)] shadow-sm">
                {getProgrammingStateSupport(summary)}
              </div>
            </div>
          </>
        ) : null}
      </section>
      <StickyActionBar
        disabled={loading || isStarting || !summary}
        label={
          isStarting
            ? "Opening your session..."
            : summary?.primaryActionLabel ?? "Start today's session"
        }
        onClick={handlePrimaryAction}
        supportingText={
          summary
            ? getProgrammingStateSupport(summary)
            : "Your next study step appears here as soon as your programming state loads."
        }
      />
    </StudentShell>
  );
}
