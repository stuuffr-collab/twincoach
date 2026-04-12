type QuestionCardProps = {
  stem: string;
  children: React.ReactNode;
  eyebrow?: string;
  helper?: string;
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

      <p className="mt-3 text-lg font-semibold leading-8 text-[var(--text)]">{stem}</p>

      {helper ? (
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{helper}</p>
      ) : null}

      <div className="mt-5">{children}</div>
    </section>
  );
}
