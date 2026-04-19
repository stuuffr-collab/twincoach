import Link from "next/link";
import type { ActiveCourseContext } from "@/src/lib/api";
import {
  formatSupportLevel,
  getSupportLevelTone,
} from "@/src/lib/course-pack-ui";
import { getSupportLevelPresentation } from "@/src/lib/support-level-presentation";

type ActiveCourseContextCardProps = {
  activeCourseContext: ActiveCourseContext;
  eyebrow: string;
  description: string;
  focusLabel?: string | null;
  linkLabel?: string;
  showPackLink?: boolean;
  compact?: boolean;
  modeMeaning?: string;
};

export function ActiveCourseContextCard({
  activeCourseContext,
  eyebrow,
  description,
  focusLabel,
  linkLabel = "افتح المقرر",
  showPackLink = true,
  compact = false,
  modeMeaning,
}: ActiveCourseContextCardProps) {
  const resolvedFocusLabel =
    focusLabel ?? activeCourseContext.focusNormalizedConceptLabel;
  const supportLevelPresentation = getSupportLevelPresentation(
    activeCourseContext.supportLevel,
  );
  const resolvedModeMeaning =
    modeMeaning ?? supportLevelPresentation.modeMeaning;

  return (
    <div
      className={`stage-card rounded-[2rem] ${
        compact ? "p-4 md:p-5" : "p-5 md:p-6"
      }`}
    >
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">
          المقرر النشط
        </span>
        <span
          className={`inline-flex rounded-full border px-3 py-1.5 text-sm font-semibold ${getSupportLevelTone(activeCourseContext.supportLevel)}`}
        >
          {formatSupportLevel(activeCourseContext.supportLevel)}
        </span>
        {resolvedFocusLabel ? (
          <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm">
            التركيز: {resolvedFocusLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-4 text-xs font-semibold text-[var(--text-muted)]">
        {eyebrow}
      </div>
      <div
        className={`mt-2 font-semibold leading-8 text-[var(--text)] ${
          compact ? "text-lg" : "text-[1.35rem] md:text-[1.5rem]"
        }`}
      >
        {activeCourseContext.courseTitle}
      </div>
      <div className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
        {description}
      </div>

      <div className="mt-4 rounded-[1.4rem] border border-[var(--border)] bg-white/82 p-4 shadow-sm">
        <div className="text-xs font-semibold text-[var(--text-muted)]">
          {supportLevelPresentation.modeMeaningLabel}
        </div>
        <div className="mt-2 text-sm leading-7 text-[var(--text)]">
          {resolvedModeMeaning}
        </div>
      </div>

      {showPackLink ? (
        <div className="mt-4">
          <Link
            className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/92 px-3.5 py-2 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            href={`/course-pack/${activeCourseContext.coursePackId}`}
          >
            <span className="text-[var(--primary)]">●</span>
            {linkLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
