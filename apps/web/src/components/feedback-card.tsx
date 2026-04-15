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
    label: "اتجاهك صحيح",
  },
  needs_review: {
    container: "border-amber-200 bg-amber-50 text-amber-900",
    label: "نراجع الفكرة",
  },
  try_fix: {
    container: "border-blue-200 bg-blue-50 text-blue-900",
    label: "نجرب تعديلًا صغيرًا",
  },
  needs_another_check: {
    container: "border-slate-200 bg-slate-50 text-slate-900",
    label: "نحتاج فحصًا أخيرًا",
  },
};

export function FeedbackCard({
  feedbackType,
  feedbackText,
  context = "session",
}: FeedbackCardProps) {
  const content = feedbackStyles[feedbackType];

  return (
    <div className={`motion-reveal rounded-[1.5rem] border p-4 shadow-sm ${content.container}`}>
      <div className="text-xs font-semibold">{content.label}</div>
      <div className="mt-2 text-sm leading-7">{feedbackText}</div>
      <div className="mt-3 text-[0.8rem] leading-6 text-[var(--text-muted)]">
        {context === "diagnostic"
          ? "نستخدم هذه الإشارة لضبط نقطة البداية."
          : "هذه الإشارة تساعدنا نحدد الخطوة التالية."}
      </div>
    </div>
  );
}
