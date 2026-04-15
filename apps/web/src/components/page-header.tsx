type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  detail?: string;
};

export function PageHeader({ title, subtitle, eyebrow, detail }: PageHeaderProps) {
  return (
    <header className="px-4 pb-5 pt-6 md:px-6 md:pb-6">
      <div className="motion-rise flex flex-col gap-3 text-right">
        {eyebrow ? (
          <div className="inline-flex w-fit self-end rounded-full border border-[var(--primary)]/12 bg-[var(--primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
            {eyebrow}
          </div>
        ) : null}

        <div className="space-y-2">
          <h1 className="max-w-[18ch] text-[1.95rem] font-semibold leading-[1.42] tracking-tight text-[var(--text)] md:text-[2.15rem]">
            {title}
          </h1>
          {subtitle ? (
            <p className="max-w-[38ch] text-sm leading-7 text-[var(--text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>

        {detail ? (
          <div className="motion-rise-delay-1 rounded-[1.25rem] border border-white/60 bg-white/72 px-4 py-3 text-sm leading-7 text-[var(--text-muted)] shadow-sm">
            {detail}
          </div>
        ) : null}
      </div>
    </header>
  );
}
