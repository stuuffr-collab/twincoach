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
      className={`motion-rise-delay-1 rounded-[1.9rem] border p-5 shadow-sm transition-all ${questionToneClasses[tone]}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {eyebrow ? (
          <div className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--text-muted)] shadow-sm">
            {eyebrow}
          </div>
        ) : null}

        {taskTypeLabel ? (
          <div className="inline-flex rounded-full border border-[var(--primary)]/15 bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)] shadow-sm">
            {taskTypeLabel}
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-lg font-semibold leading-8 text-[var(--text)] md:text-[1.18rem]">
        {stem}
      </p>

      {helper ? (
        <div className="mt-4 rounded-[1.25rem] border border-[var(--border)]/80 bg-white/76 px-4 py-3 text-sm leading-7 text-[var(--text-muted)]">
          {helper}
        </div>
      ) : null}

      {codeSnippet ? (
        <pre
          className="mt-5 overflow-x-auto rounded-[1.25rem] bg-slate-950 px-4 py-4 text-left font-mono text-sm leading-6 text-slate-100 shadow-sm"
          dir="ltr"
        >
          <code>{codeSnippet}</code>
        </pre>
      ) : null}

      <div className="mt-5">{children}</div>
    </section>
  );
}
