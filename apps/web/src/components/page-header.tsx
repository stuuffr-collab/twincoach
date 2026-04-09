type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="px-4 pb-4 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">{subtitle}</p>
      ) : null}
    </header>
  );
}
