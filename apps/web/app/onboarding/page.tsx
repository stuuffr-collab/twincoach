"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/src/components/page-header";
import { StatePanel } from "@/src/components/state-panel";
import { StickyActionBar } from "@/src/components/sticky-action-bar";
import { StudentShell } from "@/src/components/student-shell";
import {
  submitOnboarding,
  type BiggestDifficulty,
  type CurrentComfortLevel,
  type HelpKind,
  type PriorProgrammingExposure,
} from "@/src/lib/api";

const priorProgrammingExposureOptions: Array<{
  value: PriorProgrammingExposure;
  label: string;
  helper: string;
}> = [
  {
    value: "none",
    label: "None yet",
    helper: "You're just getting started with Python or programming.",
  },
  {
    value: "school_basics",
    label: "School basics",
    helper: "You've seen simple exercises or class examples before.",
  },
  {
    value: "self_taught_basics",
    label: "Self-taught basics",
    helper: "You've tried learning on your own through videos or tutorials.",
  },
  {
    value: "completed_intro_course",
    label: "Completed intro course",
    helper: "You've already finished one intro-style programming course.",
  },
];

const comfortLevelOptions: Array<{
  value: CurrentComfortLevel;
  label: string;
  helper: string;
}> = [
  {
    value: "very_low",
    label: "Very low",
    helper: "Python still feels unfamiliar most of the time.",
  },
  {
    value: "low",
    label: "Low",
    helper: "You can follow some basics, but you still get stuck often.",
  },
  {
    value: "medium",
    label: "Medium",
    helper: "You can work through short tasks, but you want steadier progress.",
  },
];

const biggestDifficultyOptions: Array<{
  value: BiggestDifficulty;
  label: string;
  helper: string;
}> = [
  {
    value: "reading_code",
    label: "Reading code",
    helper: "Understanding what code is doing line by line is the hardest part.",
  },
  {
    value: "writing_syntax",
    label: "Writing syntax",
    helper: "You often know the idea, but typing the Python form is hard.",
  },
  {
    value: "tracing_logic",
    label: "Tracing logic",
    helper: "You lose track of values, conditions, or loop flow while solving.",
  },
  {
    value: "debugging_errors",
    label: "Debugging errors",
    helper: "Fixing mistakes and knowing what to try next feels hardest.",
  },
];

const preferredHelpStyleOptions: Array<{
  value: HelpKind;
  label: string;
  helper: string;
}> = [
  {
    value: "step_breakdown",
    label: "Step breakdown",
    helper: "You like a problem split into smaller steps.",
  },
  {
    value: "worked_example",
    label: "Worked example",
    helper: "You learn best by seeing one clear example first.",
  },
  {
    value: "debugging_hint",
    label: "Debugging hint",
    helper: "You prefer a nudge toward the next fix instead of the full answer.",
  },
  {
    value: "concept_explanation",
    label: "Concept explanation",
    helper: "You want the main idea explained before trying again.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [priorProgrammingExposure, setPriorProgrammingExposure] = useState<
    PriorProgrammingExposure | ""
  >("");
  const [currentComfortLevel, setCurrentComfortLevel] = useState<
    CurrentComfortLevel | ""
  >("");
  const [biggestDifficulty, setBiggestDifficulty] = useState<
    BiggestDifficulty | ""
  >("");
  const [preferredHelpStyle, setPreferredHelpStyle] = useState<HelpKind | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isFormValid = useMemo(() => {
    return Boolean(
      priorProgrammingExposure &&
        currentComfortLevel &&
        biggestDifficulty &&
        preferredHelpStyle,
    );
  }, [
    biggestDifficulty,
    currentComfortLevel,
    preferredHelpStyle,
    priorProgrammingExposure,
  ]);

  async function handleSubmit() {
    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const onboardingPayload = {
        priorProgrammingExposure: priorProgrammingExposure as PriorProgrammingExposure,
        currentComfortLevel: currentComfortLevel as CurrentComfortLevel,
        biggestDifficulty: biggestDifficulty as BiggestDifficulty,
        preferredHelpStyle: preferredHelpStyle as HelpKind,
      };

      const payload = await submitOnboarding({
        ...onboardingPayload,
      });

      router.replace(payload.nextRoute);
    } catch {
      setError("We couldn't save your programming setup yet. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <StudentShell>
      <PageHeader
        detail="Four short choices help TwinCoach shape your first Python diagnostic and your first guided study plan."
        eyebrow="Programming setup"
        subtitle="We'll use this to start at the right pace and choose the most helpful style of support."
        title="Start your programming study state"
      />
      <section className="flex flex-1 flex-col gap-4 px-4 pb-6">
        <div className="rounded-[2rem] border border-blue-100 bg-[linear-gradient(180deg,#ffffff_0%,#f4f8ff_100%)] p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
              Python CS1
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Under 1 minute
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              4 short choices
            </span>
          </div>
          <div className="mt-4 text-lg font-semibold text-[var(--text)]">
            This gives TwinCoach the first reliable picture of how to guide your Python practice.
          </div>
          <div className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
            We are not trying to label you. We are only setting a calm starting point for
            your diagnostic, your first session mode, and the kind of help that is most
            useful when you get stuck.
          </div>
        </div>

        <div className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)] p-5 shadow-sm">
          <div className="mb-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Your setup
            </div>
            <div className="mt-2 text-base font-semibold text-[var(--text)]">
              Choose the four details that shape your first study step.
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <label className="flex flex-col gap-2 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 shadow-sm">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Prior exposure
              </span>
              <span className="text-base font-semibold text-[var(--text)]">
                How much programming have you done before?
              </span>
              <span className="text-sm leading-6 text-[var(--text-muted)]">
                Pick the closest match. This helps us set the starting pace.
              </span>
              <select
                className="min-h-14 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base shadow-sm"
                onChange={(event) =>
                  setPriorProgrammingExposure(
                    event.target.value as PriorProgrammingExposure | "",
                  )
                }
                value={priorProgrammingExposure}
              >
                <option value="">Select your prior exposure</option>
                {priorProgrammingExposureOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {priorProgrammingExposure ? (
                <span className="text-sm text-[var(--text-muted)]">
                  {
                    priorProgrammingExposureOptions.find(
                      (option) => option.value === priorProgrammingExposure,
                    )?.helper
                  }
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 shadow-sm">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Comfort level
              </span>
              <span className="text-base font-semibold text-[var(--text)]">
                How comfortable do you feel with Python right now?
              </span>
              <span className="text-sm leading-6 text-[var(--text-muted)]">
                This helps us keep the first diagnostic fair and focused.
              </span>
              <select
                className="min-h-14 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base shadow-sm"
                onChange={(event) =>
                  setCurrentComfortLevel(
                    event.target.value as CurrentComfortLevel | "",
                  )
                }
                value={currentComfortLevel}
              >
                <option value="">Select your comfort level</option>
                {comfortLevelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {currentComfortLevel ? (
                <span className="text-sm text-[var(--text-muted)]">
                  {
                    comfortLevelOptions.find(
                      (option) => option.value === currentComfortLevel,
                    )?.helper
                  }
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 shadow-sm">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Biggest difficulty
              </span>
              <span className="text-base font-semibold text-[var(--text)]">
                What feels hardest when you study programming?
              </span>
              <span className="text-sm leading-6 text-[var(--text-muted)]">
                This gives TwinCoach an early clue about where support should start.
              </span>
              <select
                className="min-h-14 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base shadow-sm"
                onChange={(event) =>
                  setBiggestDifficulty(
                    event.target.value as BiggestDifficulty | "",
                  )
                }
                value={biggestDifficulty}
              >
                <option value="">Select your biggest difficulty</option>
                {biggestDifficultyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {biggestDifficulty ? (
                <span className="text-sm text-[var(--text-muted)]">
                  {
                    biggestDifficultyOptions.find(
                      (option) => option.value === biggestDifficulty,
                    )?.helper
                  }
                </span>
              ) : null}
            </label>

            <label className="flex flex-col gap-2 rounded-[1.5rem] border border-[var(--border)] bg-white p-4 shadow-sm">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Help style
              </span>
              <span className="text-base font-semibold text-[var(--text)]">
                What kind of support usually helps you most?
              </span>
              <span className="text-sm leading-6 text-[var(--text-muted)]">
                We'll prefer this style when we offer guidance during practice.
              </span>
              <select
                className="min-h-14 rounded-2xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base shadow-sm"
                onChange={(event) =>
                  setPreferredHelpStyle(event.target.value as HelpKind | "")
                }
                value={preferredHelpStyle}
              >
                <option value="">Select your preferred help style</option>
                {preferredHelpStyleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {preferredHelpStyle ? (
                <span className="text-sm text-[var(--text-muted)]">
                  {
                    preferredHelpStyleOptions.find(
                      (option) => option.value === preferredHelpStyle,
                    )?.helper
                  }
                </span>
              ) : null}
            </label>
          </div>
        </div>

        {error ? (
          <StatePanel
            description={error}
            eyebrow="Setup issue"
            title="We couldn't save your setup yet."
            tone="error"
          />
        ) : null}
      </section>
      <StickyActionBar
        disabled={!isFormValid || isSubmitting}
        label={isSubmitting ? "Saving your setup..." : "Save and start diagnostic"}
        onClick={handleSubmit}
        supportingText="Next: a short Python diagnostic that helps TwinCoach build your first programming state."
      />
    </StudentShell>
  );
}
