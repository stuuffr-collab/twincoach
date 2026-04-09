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
      <input
        className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-base text-[var(--text)]"
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter your answer"
        type="text"
        value={value}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {choices.map((choice) => {
        const isSelected = value === choice;

        return (
          <button
            key={choice}
            className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
              isSelected
                ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--text)]"
                : "border-[var(--border)] bg-white text-[var(--text)]"
            }`}
            onClick={() => onChange(choice)}
            type="button"
          >
            {choice}
          </button>
        );
      })}
    </div>
  );
}
