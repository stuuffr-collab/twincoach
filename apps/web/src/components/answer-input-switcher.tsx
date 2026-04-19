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
      taskType === "code_completion" ? "أكمل الجزء الناقص" : "اكتب إجابة قصيرة";

    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-[var(--text)]">{promptLabel}</div>
        <input
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-14 w-full rounded-2xl border border-[var(--border)] bg-white px-4 py-3 text-left font-mono text-base text-[var(--text)] shadow-sm transition duration-200 focus:border-[var(--primary)] focus:outline-none focus:ring-4 focus:ring-[rgba(30,94,255,0.12)] placeholder:text-[var(--text-muted)]"
          dir="ltr"
          onChange={(event) => onChange(event.target.value)}
          placeholder={taskType === "code_completion" ? "اكتب الجزء الناقص" : "اكتب إجابتك"}
          spellCheck={false}
          type="text"
          value={value}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-medium text-[var(--text)]">اختر الإجابة الأقرب</div>
      {choices.map((choice) => {
        const isSelected = value === choice.choiceId;

        return (
          <button
            key={choice.choiceId}
            aria-pressed={isSelected}
            className={`min-h-14 rounded-2xl border px-4 py-3 text-right text-base font-medium transition duration-200 ${
              isSelected
                ? "scale-[1.01] border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--text)] shadow-[0_14px_28px_rgba(30,94,255,0.12)]"
                : "border-[var(--border)] bg-white text-[var(--text)] shadow-sm hover:-translate-y-0.5 hover:shadow-md"
            }`}
            onClick={() => onChange(choice.choiceId)}
            type="button"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-1 h-5 w-5 shrink-0 rounded-full border transition ${
                  isSelected
                    ? "border-[var(--primary)] bg-[var(--primary)]"
                    : "border-[var(--border)] bg-white"
                }`}
              />
              <span dir="auto">{choice.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
