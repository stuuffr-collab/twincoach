"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import { ApiError, fetchSessionSummary, type SessionSummary } from "@/src/lib/api";

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
      } catch (error) {
        if (error instanceof ApiError && error.message === "Session incomplete") {
          router.replace(`/session/${sessionId}`);
          return;
        }

        if (!cancelled) {
          setError("Unable to load your session summary.");
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
  }, [sessionId]);

  return (
    <StudentShell>
      <PageHeader
        detail="This session is saved and your study plan has been updated."
        eyebrow="Daily session"
        subtitle="Your work is saved. Here is the clearest view of what you finished."
        title="Session complete"
      />
      <section className="flex flex-1 flex-col gap-4 px-4 pb-6">
        {loading ? (
          <StatePanel
            description="We're loading the saved recap for this session."
            eyebrow="Session recap"
            title="Loading your session recap..."
            tone="loading"
          />
        ) : null}

        {error ? (
          <StatePanel
            description={error}
            eyebrow="Session recap"
            title="We couldn't load your saved recap."
            tone="error"
          />
        ) : null}

        {summary ? (
          <>
            <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Session saved
              </div>
              <div className="mt-3 text-xl font-semibold text-[var(--text)]">
                You finished today's short practice.
              </div>
              <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                Your answers are saved and your study state has been updated. Head back to
                Today's plan for the next step.
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Session recap
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-[var(--surface-muted)] p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    Completed
                  </div>
                  <div className="mt-2 text-xl font-semibold text-[var(--text)]">
                    {summary.totalItems}
                  </div>
                </div>

                <div className="rounded-2xl bg-green-50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green-700">
                    Correct
                  </div>
                  <div className="mt-2 text-xl font-semibold text-green-900">
                    {summary.correctCount}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    To review
                  </div>
                  <div className="mt-2 text-xl font-semibold text-slate-900">
                    {summary.incorrectCount}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </section>
      <StickyActionBar
        label="Back to today's plan"
        onClick={() => router.replace("/today")}
        supportingText="Your progress is already saved."
      />
    </StudentShell>
  );
}
