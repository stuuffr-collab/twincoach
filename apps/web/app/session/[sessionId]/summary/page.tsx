"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import { ApiError, fetchSessionSummary, type SessionSummary } from "@/src/lib/api";
import {
  getSessionModeLabel,
  getSessionModeTone,
} from "@/src/lib/programming-ui";

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
          setError("Unable to load your programming session recap.");
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

  return (
    <StudentShell>
      <PageHeader
        detail="This recap stays grounded in the session you just finished and updates your next study recommendation."
        eyebrow="Programming recap"
        subtitle="Your work is saved. Here's the clearest view of what improved and what should come next."
        title="Session complete"
      />
      <section className="flex flex-1 flex-col gap-4 px-4 pb-6">
        {loading ? (
          <StatePanel
            description="We're loading the saved recap for this programming session."
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
                    Focus: {summary.focusConceptLabel}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 text-xl font-semibold text-[var(--text)]">
                Your session is saved and your programming state has been updated.
              </div>
              <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
                TwinCoach will use this session to shape the next focused programming step,
                not just to count what you finished.
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
                    {summary.completedTaskCount}
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

            <div className="rounded-[1.75rem] border border-green-200 bg-green-50 p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green-800">
                {summary.whatImproved.label}
              </div>
              <div className="mt-3 text-sm leading-6 text-green-950">
                {summary.whatImproved.text}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-800">
                {summary.whatNeedsSupport.label}
              </div>
              <div className="mt-3 text-sm leading-6 text-blue-950">
                {summary.whatNeedsSupport.text}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
                {summary.studyPatternObserved.label}
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-900">
                {summary.studyPatternObserved.text}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-[var(--border)] bg-white p-5 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Next best action
              </div>
              <div className="mt-3 text-sm leading-6 text-[var(--text)]">
                {summary.nextBestAction.text}
              </div>
            </div>
          </>
        ) : null}
      </section>
      <StickyActionBar
        disabled={!summary}
        label={summary?.nextBestAction.label ?? "Back to Your Programming State"}
        onClick={() => router.replace(summary?.nextBestAction.route ?? "/today")}
        supportingText="Your progress is already saved."
      />
    </StudentShell>
  );
}
