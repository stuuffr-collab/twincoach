type FeedbackCardProps = {
  feedbackType: "correct" | "needs_review" | "try_fix" | "needs_another_check";
  feedbackText: string;
};

const feedbackStyles: Record<FeedbackCardProps["feedbackType"], string> = {
  correct: "border-green-200 bg-green-50 text-green-800",
  needs_review: "border-amber-200 bg-amber-50 text-amber-800",
  try_fix: "border-blue-200 bg-blue-50 text-blue-800",
  needs_another_check: "border-slate-200 bg-slate-50 text-slate-800",
};

export function FeedbackCard({ feedbackType, feedbackText }: FeedbackCardProps) {
  return (
    <div className={`rounded-2xl border p-4 text-sm ${feedbackStyles[feedbackType]}`}>
      {feedbackText}
    </div>
  );
}
