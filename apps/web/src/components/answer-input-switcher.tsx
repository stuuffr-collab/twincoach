type AnswerInputSwitcherProps = {
  questionType: "multiple_choice" | "numeric_input" | "expression_choice";
  choices: string[];
  value: string;
  onChange: (nextValue: string) => void;
};

export function AnswerInputSwitcher({
  questionType,
  choices,
  value,
  onChange,
}: AnswerInputSwitcherProps) {
  if (questionType === "numeric_input") {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-[var(--text)]">Enter one number</div>
        <input
          className="min-h-14 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-lg text-[var(--text)] shadow-sm placeholder:text-[var(--text-muted)]"
          inputMode="numeric"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type your answer"
          type="text"
          value={value}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-medium text-[var(--text)]">Choose one answer</div>
      {choices.map((choice) => {
        const isSelected = value === choice;

        return (
          <button
            key={choice}
            aria-pressed={isSelected}
            className={`min-h-14 rounded-2xl border px-4 py-3 text-left text-base font-medium transition ${
              isSelected
                ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--text)] shadow-sm"
                : "border-[var(--border)] bg-white text-[var(--text)] shadow-sm"
            }`}
            onClick={() => onChange(choice)}
            type="button"
          >
            <div className="flex items-center gap-3">
              <span
                className={`h-5 w-5 rounded-full border ${
                  isSelected
                    ? "border-[var(--primary)] bg-[var(--primary)]"
                    : "border-[var(--border)] bg-white"
                }`}
              />
              <span>{choice}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
