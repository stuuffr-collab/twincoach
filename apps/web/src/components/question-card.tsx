type QuestionCardProps = {
  stem: string;
  children: React.ReactNode;
};

export function QuestionCard({ stem, children }: QuestionCardProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-base font-medium leading-7 text-[var(--text)]">{stem}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
