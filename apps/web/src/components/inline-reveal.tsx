"use client";

import { useState } from "react";

type InlineRevealProps = {
  label: string;
  children: React.ReactNode;
  tone?: "neutral" | "soft" | "accent";
};

const toneClasses = {
  neutral: "border-[var(--border)] bg-white text-[var(--text)]",
  soft: "border-slate-200 bg-slate-50 text-[var(--text)]",
  accent: "border-blue-200 bg-blue-50 text-[var(--text)]",
};

export function InlineReveal({
  label,
  children,
  tone = "neutral",
}: InlineRevealProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-3">
      <button
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--text-muted)] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>{label}</span>
        <span className="text-[var(--primary)]">{isOpen ? "−" : "+"}</span>
      </button>

      {isOpen ? (
        <div className={`motion-reveal rounded-[1.35rem] border px-4 py-3 text-sm leading-7 shadow-sm ${toneClasses[tone]}`}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
