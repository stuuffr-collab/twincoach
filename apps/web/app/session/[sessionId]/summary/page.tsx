"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/src/components/page-header";
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
        title="Session Summary"
        subtitle="Your daily session has been saved."
      />
      <section className="flex flex-1 flex-col gap-4 px-4 pb-6">
        {loading ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
            Loading your summary...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {summary ? (
          <>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Questions completed
              </div>
              <div className="mt-2 text-base font-semibold text-[var(--text)]">
                {summary.totalItems}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Correct answers
              </div>
              <div className="mt-2 text-base font-semibold text-[var(--text)]">
                {summary.correctCount}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Incorrect answers
              </div>
              <div className="mt-2 text-base font-semibold text-[var(--text)]">
                {summary.incorrectCount}
              </div>
            </div>
          </>
        ) : null}
      </section>
      <StickyActionBar label="Back to Today" onClick={() => router.replace("/today")} />
    </StudentShell>
  );
}
