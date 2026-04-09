type StudentShellProps = {
  children: React.ReactNode;
};

export function StudentShell({ children }: StudentShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-[var(--background)]">
      {children}
    </main>
  );
}
