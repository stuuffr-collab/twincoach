type PageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  detail?: string;
};

export function PageHeader({ title, subtitle, eyebrow, detail }: PageHeaderProps) {
  return (
    <header className="px-4 pb-5 pt-6">
      <div className="flex flex-col gap-3">
        {eyebrow ? (
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {eyebrow}
          </div>
        ) : null}

        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-[var(--text)]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-[32ch] text-sm leading-6 text-[var(--text-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>

        {detail ? (
          <p className="text-xs leading-5 text-[var(--text-muted)]">{detail}</p>
        ) : null}
      </div>
    </header>
  );
}
