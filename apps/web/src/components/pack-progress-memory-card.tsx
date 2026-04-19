import type { PackProgressMemory } from "@/src/lib/api";
import {
  getPackProgressHistoryItemLabel,
  getPackProgressHistoryItemTone,
  getPackProgressMemoryPresentation,
} from "@/src/lib/course-pack-progress-memory-presentation";

type PackProgressMemoryCardProps = {
  surface: "today" | "profile" | "workspace";
  courseTitle: string;
  currentFocusLabel: string;
  memory: PackProgressMemory;
  compact?: boolean;
};

export function PackProgressMemoryCard({
  surface,
  courseTitle,
  currentFocusLabel,
  memory,
  compact = false,
}: PackProgressMemoryCardProps) {
  const presentation = getPackProgressMemoryPresentation(surface, {
    courseTitle,
    currentFocusLabel,
    memory,
  });

  return (
    <div
      className={`stage-card rounded-[2rem] ${
        compact ? "p-4 md:p-5" : "p-5 md:p-6"
      }`}
    >
      <div className="text-xs font-semibold text-[var(--text-muted)]">
        ذاكرة المسار القريب
      </div>
      <div
        className={`mt-2 font-semibold leading-8 text-[var(--text)] ${
          compact ? "text-lg" : "text-[1.3rem] md:text-[1.45rem]"
        }`}
      >
        {presentation.title}
      </div>
      <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
        {presentation.description}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {memory.recentFocusHistory.map((item) => (
          <div
            key={item.normalizedConceptId ?? `${item.label}-${item.observedAt}`}
            className={`rounded-full border px-3 py-2 text-sm font-semibold shadow-sm ${getPackProgressHistoryItemTone(item)}`}
          >
            <span>{item.label}</span>
            <span className="mx-2 text-[0.8em] opacity-60">•</span>
            <span>{getPackProgressHistoryItemLabel(item)}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {presentation.carryForwardText ? (
          <div className="rounded-[1.3rem] border border-blue-200 bg-blue-50 p-4 shadow-sm">
            <div className="text-xs font-semibold text-blue-800">
              ما نبني عليه الآن
            </div>
            <div className="mt-2 text-sm leading-7 text-blue-950">
              {presentation.carryForwardText}
            </div>
          </div>
        ) : null}

        {presentation.stabilizedText ? (
          <div className="rounded-[1.3rem] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="text-xs font-semibold text-emerald-800">
              ما استقر مؤخرًا
            </div>
            <div className="mt-2 text-sm leading-7 text-emerald-950">
              {presentation.stabilizedText}
            </div>
          </div>
        ) : null}

        {presentation.recurringText ? (
          <div className="rounded-[1.3rem] border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <div className="text-xs font-semibold text-amber-900">
              ما زال يعود
            </div>
            <div className="mt-2 text-sm leading-7 text-amber-950">
              {presentation.recurringText}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
