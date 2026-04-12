"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import { fetchActiveUnits, submitOnboarding, type ActiveUnit } from "@/src/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const [examDate, setExamDate] = useState("");
  const [activeUnitId, setActiveUnitId] = useState("");
  const [activeUnits, setActiveUnits] = useState<ActiveUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadUnits() {
      try {
        const payload = await fetchActiveUnits();
        if (cancelled) {
          return;
        }

        setActiveUnits(payload);
      } catch {
        if (!cancelled) {
          setError("Unable to load active units.");
        }
      } finally {
        if (!cancelled) {
          setLoadingUnits(false);
        }
      }
    }

    void loadUnits();

    return () => {
      cancelled = true;
    };
  }, []);

  const isFormValid = useMemo(() => {
    return /^\d{4}-\d{2}-\d{2}$/.test(examDate) && activeUnitId.length > 0;
  }, [activeUnitId, examDate]);

  async function handleSubmit() {
    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const payload = await submitOnboarding({
        examDate,
        activeUnitId,
      });

      router.replace(payload.nextRoute);
    } catch {
      setError("We couldn't save your setup. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <StudentShell>
      <PageHeader
        detail="Two details now give TwinCoach the right starting point for the rest of your learner flow."
        eyebrow="Welcome to TwinCoach"
        subtitle="Set your exam date and current unit so your study plan starts in the right place."
        title="Start with a focused study plan"
      />
      <section className="flex flex-1 flex-col gap-4 px-4 pb-6">
        <div className="rounded-[2rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
              Under 1 minute
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              2 details only
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              College Algebra focused
            </span>
          </div>
          <div className="mt-4 text-lg font-semibold text-[var(--text)]">
            We'll turn this into your first diagnostic and today's starting plan.
          </div>
          <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            This does not change your course. It simply helps TwinCoach start at the right pace
            and level for your exam timeline.
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-5 shadow-sm">
          <div className="mb-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Your setup
            </div>
            <div className="mt-2 text-base font-semibold text-[var(--text)]">
              Give us the two details that shape your first study step.
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <label className="flex flex-col gap-2 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 shadow-sm">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Exam date
              </span>
              <span className="text-base font-semibold text-[var(--text)]">When is the exam?</span>
              <span className="text-sm leading-6 text-[var(--text-muted)]">
                We use this to keep your plan paced and realistic.
              </span>
              <input
                className="min-h-14 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base shadow-sm"
                onChange={(event) => setExamDate(event.target.value)}
                type="date"
                value={examDate}
              />
            </label>

            <label className="flex flex-col gap-2 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 shadow-sm">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Current unit
              </span>
              <span className="text-base font-semibold text-[var(--text)]">
                What are you covering now?
              </span>
              <span className="text-sm leading-6 text-[var(--text-muted)]">
                Pick the unit you are covering now so your starting point makes sense.
              </span>
              <select
                className="min-h-14 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base shadow-sm"
                disabled={loadingUnits}
                onChange={(event) => setActiveUnitId(event.target.value)}
                value={activeUnitId}
              >
                <option value="">Select your current unit</option>
                {activeUnits.map((unit) => (
                  <option key={unit.activeUnitId} value={unit.activeUnitId}>
                    {unit.sequenceOrder}. {unit.learnerFacingLabel}
                  </option>
                ))}
              </select>
              {loadingUnits ? (
                <span className="text-sm text-[var(--text-muted)]">Loading your available units...</span>
              ) : null}
            </label>
          </div>
        </div>

        {error ? (
          <StatePanel
            description={error}
            eyebrow="Setup issue"
            title="We couldn't save your setup yet."
            tone="error"
          />
        ) : null}
      </section>
      <StickyActionBar
        disabled={!isFormValid || isSubmitting || loadingUnits}
        label={isSubmitting ? "Saving your setup..." : "Save and start diagnostic"}
        onClick={handleSubmit}
        supportingText="Next: a short diagnostic that helps TwinCoach build your starting plan."
      />
    </StudentShell>
  );
}
