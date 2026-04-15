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
          setError("تعذّر تحميل بداية مسارك الآن.");
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
        detail="إذا كانت هذه بدايتك، سنبني نقطة انطلاق مناسبة لك. وإذا كنت عائدًا، سنرجعك مباشرة إلى الخطوة البرمجية الصحيحة."
        eyebrow="TwinCoach"
        subtitle="رفيقك العربي الهادئ لتعلّم أساسيات بايثون خطوة بخطوة."
        title="ابدأ من الخطوة الأنسب لك"
      />
      <section className="flex flex-1 flex-col gap-3 px-4 pb-6">
        <div className="rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="text-xs font-semibold text-[var(--text-muted)]">
            كيف يسير المسار
          </div>
          <div className="mt-3 flex flex-col gap-3 text-sm leading-7 text-[var(--text-muted)]">
            <div>
              <span className="font-semibold text-[var(--text)]">1.</span> نضبط نقطة البداية
              المناسبة لك.
            </div>
            <div>
              <span className="font-semibold text-[var(--text)]">2.</span> نأخذك في تهيئة
              قصيرة لفهم حالتك البرمجية.
            </div>
            <div>
              <span className="font-semibold text-[var(--text)]">3.</span> نفتح لك تدريب
              اليوم خطوة واحدة في كل مرة.
            </div>
          </div>
        </div>

        {error ? (
          <StatePanel
            description={error}
            eyebrow="بداية المسار"
            title="تعذّر علينا فتح خطوتك التالية الآن."
            tone="error"
          />
        ) : (
          <StatePanel
            description={
              bootState
                ? "وجدنا خطوتك التالية وسنأخذك إليها الآن."
                : "هذا يستغرق لحظة قصيرة فقط."
            }
            eyebrow="نحضّر المسار"
            title={
              bootState
                ? bootState.nextRoute === "/onboarding"
                  ? "نفتح بداية مسارك"
                  : bootState.nextRoute === "/diagnostic"
                    ? "نرجعك إلى التهيئة الأولى"
                    : "نحمّل تدريب اليوم"
                : "نراجع حالتك المحفوظة"
            }
            tone="loading"
          />
        )}
      </section>
    </StudentShell>
  );
}
