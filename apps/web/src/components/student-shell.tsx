type StudentShellProps = {
  children: React.ReactNode;
};

export function StudentShell({ children }: StudentShellProps) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#edf4ff_0%,#f6f8fc_30%,#eef2f8_100%)] px-0 md:px-6 md:py-8">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-stretch justify-center md:min-h-0 md:items-center">
        <main className="relative flex min-h-screen w-full max-w-md flex-col bg-[var(--background)] md:min-h-[860px] md:rounded-[32px] md:border md:border-white/70 md:bg-[color:rgb(247_248_252_/_0.96)] md:shadow-[0_32px_90px_rgba(15,23,42,0.14)]">
          {children}
        </main>
      </div>
    </div>
  );
}
