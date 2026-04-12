type StatePanelTone = "neutral" | "loading" | "error" | "recovery";

type StatePanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  tone?: StatePanelTone;
};

const statePanelStyles: Record<StatePanelTone, string> = {
  neutral: "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
  loading: "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
  error: "border-red-200 bg-red-50 text-red-900",
  recovery: "border-blue-200 bg-blue-50 text-blue-900",
};

export function StatePanel({
  eyebrow,
  title,
  description,
  tone = "neutral",
}: StatePanelProps) {
  return (
    <div
      className={`rounded-[1.75rem] border p-5 shadow-sm transition-all ${statePanelStyles[tone]}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {eyebrow}
      </div>
      <div className="mt-3 text-base font-semibold">{title}</div>
      <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</div>
    </div>
  );
}
