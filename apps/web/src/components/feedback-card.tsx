type FeedbackCardProps = {
  feedbackType: "correct" | "needs_review" | "try_fix" | "needs_another_check";
  feedbackText: string;
  context?: "diagnostic" | "session";
};

const feedbackStyles: Record<
  FeedbackCardProps["feedbackType"],
  {
    container: string;
    label: string;
  }
> = {
  correct: {
    container: "border-green-200 bg-green-50 text-green-900",
    label: "Correct",
  },
  needs_review: {
    container: "border-amber-200 bg-amber-50 text-amber-900",
    label: "Review this idea",
  },
  try_fix: {
    container: "border-blue-200 bg-blue-50 text-blue-900",
    label: "Try the setup again",
  },
  needs_another_check: {
    container: "border-slate-200 bg-slate-50 text-slate-900",
    label: "One more check",
  },
};

export function FeedbackCard({
  feedbackType,
  feedbackText,
  context = "session",
}: FeedbackCardProps) {
  const content = feedbackStyles[feedbackType];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${content.container}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">
        {content.label}
      </div>
      <div className="mt-2 text-sm leading-6">{feedbackText}</div>
      <div className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
        {context === "diagnostic"
          ? "This helps us place your next study step more accurately."
          : "Use this signal to move through today's session one step at a time."}
      </div>
    </div>
  );
}
