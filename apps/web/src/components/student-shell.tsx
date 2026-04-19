"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getLearnerId } from "@/src/lib/api";
import {
  formatSupportLevel,
  getSupportLevelTone,
} from "@/src/lib/course-pack-ui";
import { readLearnerProfileLite } from "@/src/lib/learner-profile-lite";

type StudentShellProps = {
  children: React.ReactNode;
};

function shouldShowLearnerControls(pathname: string) {
  return !(
    pathname.startsWith("/admin") ||
    pathname === "/onboarding" ||
    pathname === "/diagnostic"
  );
}

export function StudentShell({ children }: StudentShellProps) {
  const pathname = usePathname() ?? "/";
  const [hasLearnerId, setHasLearnerId] = useState(false);
  const [activeCourseContext, setActiveCourseContext] = useState(() => {
    const profile = readLearnerProfileLite();

    if (profile.latestProgrammingState) {
      return profile.latestProgrammingState.activeCourseContext;
    }

    return profile.latestSummary?.activeCourseContext ?? null;
  });
  const showLearnerControls = hasLearnerId && shouldShowLearnerControls(pathname);
  const profileHref = pathname === "/profile" ? "/today" : "/profile";
  const profileLabel = pathname === "/profile" ? "حالتك اليوم" : "ملفي";
  const showCoursePackEntry = !pathname.startsWith("/course-pack");

  useEffect(() => {
    setHasLearnerId(Boolean(getLearnerId()));

    function syncProfileLite() {
      const profile = readLearnerProfileLite();
      setActiveCourseContext(
        profile.latestProgrammingState
          ? profile.latestProgrammingState.activeCourseContext
          : profile.latestSummary?.activeCourseContext ?? null,
      );
    }

    syncProfileLite();
    window.addEventListener("twincoach:profile-lite-updated", syncProfileLite);
    window.addEventListener("storage", syncProfileLite);

    return () => {
      window.removeEventListener(
        "twincoach:profile-lite-updated",
        syncProfileLite,
      );
      window.removeEventListener("storage", syncProfileLite);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e6efff_0%,#f4f7fb_34%,#edf3f9_100%)] px-0 md:px-8 md:py-10">
      <div className="mx-auto flex min-h-screen w-full max-w-[1160px] items-stretch justify-center md:min-h-0 md:items-center">
        <main
          className="relative flex min-h-screen w-full max-w-[860px] flex-col overflow-hidden bg-[var(--background)] md:min-h-[880px] md:rounded-[38px] md:border md:border-white/70 md:bg-[color:rgb(247_248_252_/_0.98)] md:shadow-[0_36px_100px_rgba(15,23,42,0.14)]"
          dir="rtl"
          lang="ar"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,#dce8ff_0%,rgba(220,232,255,0.55)_34%,rgba(244,247,251,0)_100%)]" />
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-24 bg-[linear-gradient(90deg,rgba(255,255,255,0.48),rgba(255,255,255,0))] md:block" />

          {showLearnerControls ? (
            <div className="relative z-10 px-4 pt-4 md:px-6 md:pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[0.78rem] font-medium text-[var(--text-muted)]">
                  مسار موجّه وقصير
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {showCoursePackEntry ? (
                    <Link
                      className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3.5 py-2 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      href="/course-pack"
                    >
                      <span className="text-[var(--primary)]">●</span>
                      مقررك
                    </Link>
                  ) : null}
                  <Link
                    className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/88 px-3.5 py-2 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    href={profileHref}
                  >
                    <span className="text-[var(--primary)]">●</span>
                    {profileLabel}
                  </Link>
                </div>
              </div>

              {activeCourseContext ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[1.5rem] border border-white/75 bg-white/78 px-3.5 py-3 shadow-sm backdrop-blur-sm">
                  <Link
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    href={`/course-pack/${activeCourseContext.coursePackId}`}
                  >
                    <span className="text-[var(--primary)]">●</span>
                    <span className="max-w-[16rem] truncate">
                      {activeCourseContext.courseTitle}
                    </span>
                  </Link>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${getSupportLevelTone(activeCourseContext.supportLevel)}`}
                  >
                    {formatSupportLevel(activeCourseContext.supportLevel)}
                  </span>
                  {activeCourseContext.focusNormalizedConceptLabel ? (
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] shadow-sm">
                      الآن: {activeCourseContext.focusNormalizedConceptLabel}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="relative flex min-h-screen flex-col md:min-h-[880px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
