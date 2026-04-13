"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/src/components/page-header";
import {
  ApiError,
  fetchAdminLearner,
  fetchRecentAdminLearners,
  type AdminLearnerLookup,
  type AdminRecentLearner,
} from "@/src/lib/api";
import { hasAdminKey } from "@/src/lib/admin-access";

function formatTokenLabel(value: string | null | undefined) {
  if (!value) {
    return "Not available yet";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AdminLearnersPage() {
  const [learnerId, setLearnerId] = useState("");
  const [recentLearners, setRecentLearners] = useState<AdminRecentLearner[]>([]);
  const [result, setResult] = useState<AdminLearnerLookup | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRecentLearners() {
      if (!hasAdminKey()) {
        setError("Admin access key required. Return to /admin first.");
        setLoadingRecent(false);
        return;
      }

      try {
        const payload = await fetchRecentAdminLearners();

        if (!cancelled) {
          setRecentLearners(payload);
        }
      } catch (fetchError) {
        if (!cancelled) {
          if (fetchError instanceof ApiError) {
            setError(fetchError.message);
          } else {
            setError("Unable to load recent learners.");
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingRecent(false);
        }
      }
    }

    void loadRecentLearners();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadLearner(nextLearnerId: string) {
    setLoading(true);
    setError("");

    try {
      const payload = await fetchAdminLearner(nextLearnerId);
      setResult(payload);
      setLearnerId(nextLearnerId);
    } catch (fetchError) {
      if (fetchError instanceof ApiError) {
        setError(fetchError.message);
      } else {
        setError("Unable to load learner lookup.");
      }
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!learnerId.trim() || loading) {
      return;
    }

    await loadLearner(learnerId.trim());
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <PageHeader
        title="Learner Lookup"
        subtitle="Inspect programming onboarding, persona state, recent errors, and the latest session recap before supporting an alpha learner."
      />

      <section className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="text-sm font-semibold text-[var(--text)]">
          Recent learners
        </div>
        {loadingRecent ? (
          <div className="text-sm text-[var(--text-muted)]">
            Loading recent learners...
          </div>
        ) : recentLearners.length === 0 ? (
          <div className="text-sm text-[var(--text-muted)]">
            No recent learners found yet.
          </div>
        ) : (
          <div className="grid gap-2">
            {recentLearners.map((recentLearner) => {
              const previewSessionId =
                recentLearner.activeDailySessionId ||
                recentLearner.activeDiagnosticSessionId;

              return (
                <div
                  className="rounded-lg border border-[var(--border)] px-3 py-3 text-sm text-[var(--text)]"
                  key={recentLearner.learnerId}
                >
                  <div className="font-medium">{recentLearner.learnerId}</div>
                  <div className="mt-1 text-[var(--text-muted)]">
                    Focus: {recentLearner.focusConceptLabel || "Not available yet"}
                  </div>
                  <div className="text-[var(--text-muted)]">
                    Mode: {formatTokenLabel(recentLearner.sessionMode)} | Momentum:{" "}
                    {formatTokenLabel(recentLearner.sessionMomentumState)}
                  </div>
                  <div className="text-[var(--text-muted)]">
                    Last activity: {recentLearner.lastActivityAt}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button
                      className="rounded-lg bg-[var(--text)] px-3 py-2 text-xs font-semibold text-white"
                      onClick={() => void loadLearner(recentLearner.learnerId)}
                      type="button"
                    >
                      Load learner
                    </button>
                    {previewSessionId ? (
                      <Link
                        className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium"
                        href={`/admin/preview?sessionId=${encodeURIComponent(previewSessionId)}`}
                      >
                        Open active session preview
                      </Link>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <form className="grid gap-3" onSubmit={handleSubmit}>
        <input
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)]"
          onChange={(event) => setLearnerId(event.target.value)}
          placeholder="Enter learnerId"
          value={learnerId}
        />
        <button
          className="rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          disabled={loading || !learnerId.trim()}
          type="submit"
        >
          {loading ? "Loading..." : "Load learner by id"}
        </button>
      </form>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <section className="grid gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-sm font-semibold text-[var(--text)]">
              {result.learnerId}
            </div>
            <div className="mt-2 text-sm text-[var(--text-muted)]">
              Focus concept:{" "}
              {result.personaSnapshot.focusConceptLabel || "Not available yet"}
            </div>
            <div className="text-sm text-[var(--text-muted)]">
              Momentum: {formatTokenLabel(result.personaSnapshot.sessionMomentumState)}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {result.activeDiagnosticSessionId ? (
                <div className="text-[var(--text-muted)]">
                  Active diagnostic: {result.activeDiagnosticSessionId}
                </div>
              ) : null}
              {result.activeDailySessionId ? (
                <div className="text-[var(--text-muted)]">
                  Active daily: {result.activeDailySessionId}
                </div>
              ) : null}
              {(result.activeDailySessionId || result.activeDiagnosticSessionId) ? (
                <Link
                  className="underline"
                  href={`/admin/preview?sessionId=${encodeURIComponent(
                    result.activeDailySessionId || result.activeDiagnosticSessionId,
                  )}`}
                >
                  Open session preview tool
                </Link>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-sm font-semibold text-[var(--text)]">
                Onboarding profile
              </div>
              {result.onboardingProfile ? (
                <div className="mt-3 grid gap-2 text-sm text-[var(--text-muted)]">
                  <div>
                    Prior exposure:{" "}
                    {formatTokenLabel(result.onboardingProfile.priorProgrammingExposure)}
                  </div>
                  <div>
                    Comfort level:{" "}
                    {formatTokenLabel(result.onboardingProfile.currentComfortLevel)}
                  </div>
                  <div>
                    Biggest difficulty:{" "}
                    {formatTokenLabel(result.onboardingProfile.biggestDifficulty)}
                  </div>
                  <div>
                    Preferred help style:{" "}
                    {formatTokenLabel(result.onboardingProfile.preferredHelpStyle)}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-[var(--text-muted)]">
                  Programming onboarding profile not found.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-sm font-semibold text-[var(--text)]">
                Persona snapshot
              </div>
              <div className="mt-3 grid gap-2 text-sm text-[var(--text-muted)]">
                <div>
                  Preferred help style:{" "}
                  {formatTokenLabel(result.personaSnapshot.preferredHelpStyle)}
                </div>
                <div>
                  Syntax stability:{" "}
                  {formatTokenLabel(result.personaSnapshot.syntaxStabilityState)}
                </div>
                <div>
                  Logic tracing:{" "}
                  {formatTokenLabel(result.personaSnapshot.logicTracingState)}
                </div>
                <div>
                  Debugging resilience:{" "}
                  {formatTokenLabel(
                    result.personaSnapshot.debuggingResilienceState,
                  )}
                </div>
                <div>
                  Session momentum:{" "}
                  {formatTokenLabel(result.personaSnapshot.sessionMomentumState)}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="text-sm font-semibold text-[var(--text)]">
              Concept mastery
            </div>
            <div className="mt-3 grid gap-2">
              {result.personaSnapshot.conceptStates.map((conceptState) => (
                <div
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
                  key={conceptState.conceptId}
                >
                  <div className="font-medium">{conceptState.conceptLabel}</div>
                  <div className="text-[var(--text-muted)]">
                    Mastery: {formatTokenLabel(conceptState.masteryState)} | Recent
                    error: {formatTokenLabel(conceptState.recentErrorTag)}
                  </div>
                  {conceptState.lastObservedAt ? (
                    <div className="text-[var(--text-muted)]">
                      Last observed: {conceptState.lastObservedAt}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-sm font-semibold text-[var(--text)]">
                Recent error tags
              </div>
              {result.recentErrorTags.length === 0 ? (
                <div className="mt-3 text-sm text-[var(--text-muted)]">
                  No tagged programming errors yet.
                </div>
              ) : (
                <div className="mt-3 grid gap-2">
                  {result.recentErrorTags.map((errorTag, index) => (
                    <div
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)]"
                      key={`${errorTag.sessionItemId}-${index}`}
                    >
                      <div className="font-medium">
                        {formatTokenLabel(errorTag.primaryErrorTag)}
                      </div>
                      <div className="text-[var(--text-muted)]">
                        {errorTag.createdAt}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-sm font-semibold text-[var(--text)]">
                Latest summary snapshot
              </div>
              {result.latestSummarySnapshot ? (
                <div className="mt-3 grid gap-2 text-sm text-[var(--text-muted)]">
                  <div>
                    Session: {result.latestSummarySnapshot.sessionId}
                  </div>
                  <div>
                    Focus:{" "}
                    {result.latestSummarySnapshot.focusConceptLabel ||
                      "Not available yet"}
                  </div>
                  <div>
                    Mode: {formatTokenLabel(result.latestSummarySnapshot.sessionMode)}
                  </div>
                  <div>
                    What improved:{" "}
                    {formatTokenLabel(
                      result.latestSummarySnapshot.whatImproved.code,
                    )}
                  </div>
                  <div>
                    Still needs support:{" "}
                    {formatTokenLabel(
                      result.latestSummarySnapshot.whatNeedsSupport.code,
                    )}
                  </div>
                  <div>
                    Study pattern:{" "}
                    {formatTokenLabel(
                      result.latestSummarySnapshot.studyPatternObserved.code,
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-[var(--text-muted)]">
                  No completed daily session summary yet.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
