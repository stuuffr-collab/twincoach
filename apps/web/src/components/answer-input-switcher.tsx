import type {
  AnswerFormat,
  ProgrammingTaskChoice,
  ProgrammingTaskType,
} from "@/src/lib/api";

type AnswerInputSwitcherProps = {
  answerFormat: AnswerFormat;
  taskType: ProgrammingTaskType;
  choices: ProgrammingTaskChoice[];
  value: string;
  onChange: (nextValue: string) => void;
};

export function AnswerInputSwitcher({
  answerFormat,
  taskType,
  choices,
  value,
  onChange,
}: AnswerInputSwitcherProps) {
  if (answerFormat === "short_text") {
    const promptLabel =
      taskType === "code_completion"
        ? "Complete the missing code"
        : "Enter one short answer";

    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-[var(--text)]">{promptLabel}</div>
        <input
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-14 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 font-mono text-base text-[var(--text)] shadow-sm placeholder:text-[var(--text-muted)]"
          onChange={(event) => onChange(event.target.value)}
          placeholder={
            taskType === "code_completion" ? "Type the missing code" : "Type your answer"
          }
          spellCheck={false}
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
        const isSelected = value === choice.choiceId;

        return (
          <button
            key={choice.choiceId}
            aria-pressed={isSelected}
            className={`min-h-14 rounded-2xl border px-4 py-3 text-left text-base font-medium transition ${
              isSelected
                ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--text)] shadow-sm"
                : "border-[var(--border)] bg-white text-[var(--text)] shadow-sm"
            }`}
            onClick={() => onChange(choice.choiceId)}
            type="button"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-1 h-5 w-5 rounded-full border ${
                  isSelected
                    ? "border-[var(--primary)] bg-[var(--primary)]"
                    : "border-[var(--border)] bg-white"
                }`}
              />
              <span>{choice.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
