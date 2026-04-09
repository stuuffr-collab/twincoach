type ProgressBarProps = {
  currentIndex: number;
  totalItems: number;
};

export function ProgressBar({ currentIndex, totalItems }: ProgressBarProps) {
  const safeTotal = totalItems > 0 ? totalItems : 1;
  const percentage = Math.min(100, Math.max(0, (currentIndex / safeTotal) * 100));

  return (
    <div className="px-4">
      <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <span>
          Question {currentIndex} of {totalItems}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--border)]">
        <div
          className="h-2 rounded-full bg-[var(--primary)] transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
