"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StudentShell } from "@/src/components/student-shell";
import { fetchBootState, type BootState } from "@/src/lib/api";

export default function BootPage() {
  const router = useRouter();
  const [bootState, setBootState] = useState<BootState | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBootState() {
      try {
        const payload = await fetchBootState();
        if (cancelled) {
          return;
        }

        setBootState(payload);
        router.replace(payload.nextRoute);
      } catch {
        if (!cancelled) {
          setError("Unable to load your start state.");
        }
      }
    }

    void loadBootState();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <StudentShell>
      <PageHeader
        detail="New learners start with a short setup. Returning learners resume the right next step automatically."
        eyebrow="TwinCoach"
        subtitle="Your personal exam coach for College Algebra."
        title="Start with a clear next step"
      />
      <section className="flex flex-1 flex-col gap-3 px-4 pb-6">
        <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            How it works
          </div>
          <div className="mt-3 flex flex-col gap-3 text-sm leading-6 text-[var(--text-muted)]">
            <div>
              <span className="font-semibold text-[var(--text)]">1.</span> Set your exam date
              and current unit.
            </div>
            <div>
              <span className="font-semibold text-[var(--text)]">2.</span> Complete a short
              diagnostic to build your first plan.
            </div>
            <div>
              <span className="font-semibold text-[var(--text)]">3.</span> Follow today's
              guided session one step at a time.
            </div>
          </div>
        </div>

        {error ? (
          <StatePanel
            description={error}
            eyebrow="Start state"
            title="We couldn't load your next step."
            tone="error"
          />
        ) : (
          <StatePanel
            description={
              bootState
                ? "We found your next step and are taking you there now."
                : "This usually takes just a moment."
            }
            eyebrow="Getting ready"
            title={
              bootState
                ? bootState.nextRoute === "/onboarding"
                  ? "Opening your study setup"
                  : bootState.nextRoute === "/diagnostic"
                    ? "Resuming your diagnostic"
                    : "Loading today's plan"
                : "Checking your saved study state"
            }
            tone="loading"
          />
        )}
      </section>
    </StudentShell>
  );
}
