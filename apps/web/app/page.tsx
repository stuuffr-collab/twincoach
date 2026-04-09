"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/src/components/page-header";
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
      <PageHeader title="Starting up" subtitle="Checking your current step." />
      <section className="flex flex-1 flex-col gap-3 px-4 pb-6">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
            {bootState ? "Redirecting..." : "Loading boot state..."}
          </div>
        )}
      </section>
    </StudentShell>
  );
}
