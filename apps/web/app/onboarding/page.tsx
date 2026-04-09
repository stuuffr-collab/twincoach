"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/src/components/page-header";
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
        title="Set up your exam"
        subtitle="Choose your exam date and where you are in the course."
      />
      <section className="flex flex-1 flex-col gap-4 px-4 pb-6">
        <label className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-sm font-medium text-[var(--text)]">Exam date</span>
          <input
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            onChange={(event) => setExamDate(event.target.value)}
            type="date"
            value={examDate}
          />
        </label>

        <label className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <span className="text-sm font-medium text-[var(--text)]">Current unit</span>
          <select
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
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
        </label>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>
      <StickyActionBar
        disabled={!isFormValid || isSubmitting || loadingUnits}
        label={isSubmitting ? "Saving..." : "Build My Math Coach"}
        onClick={handleSubmit}
      />
    </StudentShell>
  );
}
