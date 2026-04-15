type ProgressBarProps = {
  currentIndex: number;
  totalItems: number;
  label?: string;
  badgeText?: string;
  supportingText?: string;
  tone?: "diagnostic" | "session";
};

const toneClasses = {
  diagnostic: {
    container: "border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)]",
    badge: "bg-slate-100 text-slate-700",
    bar: "bg-[var(--primary)]",
  },
  session: {
    container: "border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f3f7ff_100%)]",
    badge: "bg-blue-50 text-blue-800",
    bar: "bg-[var(--primary)]",
  },
};

export function ProgressBar({
  currentIndex,
  totalItems,
  label = "التقدّم الحالي",
  badgeText = "محفوظ أولًا بأول",
  supportingText,
  tone = "session",
}: ProgressBarProps) {
  const safeTotal = totalItems > 0 ? totalItems : 1;
  const percentage = Math.min(100, Math.max(0, (currentIndex / safeTotal) * 100));
  const classes = toneClasses[tone];

  return (
    <div className="px-4 md:px-6">
      <div className={`motion-rise rounded-[1.65rem] border px-4 py-3 shadow-sm ${classes.container}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[var(--text-muted)]">
              {label}
            </div>
            <div className="mt-1 text-sm font-medium text-[var(--text)]">
              <span dir="ltr">{currentIndex} / {totalItems}</span> خطوة
            </div>
          </div>
          <div className={`rounded-full px-2.5 py-1 text-xs font-medium ${classes.badge}`}>
            {badgeText}
          </div>
        </div>

        <div className="h-2.5 rounded-full bg-[var(--border)]" dir="ltr">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ease-out ${classes.bar}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {supportingText ? (
          <div className="mt-2 text-[0.8rem] leading-6 text-[var(--text-muted)]">
            {supportingText}
          </div>
        ) : null}
      </div>
    </div>
  );
}
