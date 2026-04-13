type QuestionCardProps = {
  stem: string;
  children: React.ReactNode;
  eyebrow?: string;
  helper?: string;
  taskTypeLabel?: string;
  codeSnippet?: string | null;
  tone?: "diagnostic" | "session";
};

const questionToneClasses = {
  diagnostic: "border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbff_100%)]",
  session: "border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f3f7ff_100%)]",
};

export function QuestionCard({
  stem,
  children,
  eyebrow,
  helper,
  taskTypeLabel,
  codeSnippet,
  tone = "session",
}: QuestionCardProps) {
  return (
    <section
      className={`rounded-[1.75rem] border p-5 shadow-sm transition-all ${questionToneClasses[tone]}`}
    >
      {eyebrow ? (
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          {eyebrow}
        </div>
      ) : null}

      {taskTypeLabel ? (
        <div className="mt-3 inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text)] shadow-sm">
          {taskTypeLabel}
        </div>
      ) : null}

      <p className="mt-3 text-lg font-semibold leading-8 text-[var(--text)]">{stem}</p>

      {helper ? (
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{helper}</p>
      ) : null}

      {codeSnippet ? (
        <pre className="mt-5 overflow-x-auto rounded-[1.25rem] bg-slate-950 px-4 py-4 font-mono text-sm leading-6 text-slate-100 shadow-sm">
          <code>{codeSnippet}</code>
        </pre>
      ) : null}

      <div className="mt-5">{children}</div>
    </section>
  );
}
