type StickyActionBarProps = {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
  supportingText?: string;
};

export function StickyActionBar({
  label,
  disabled = false,
  onClick,
  supportingText,
}: StickyActionBarProps) {
  return (
    <div className="sticky bottom-0 mt-auto border-t border-[var(--border)]/80 bg-[color:rgb(255_255_255_/_0.94)] backdrop-blur">
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3 md:px-6">
        {supportingText ? (
          <p className="mb-2 text-right text-[0.8rem] leading-6 text-[var(--text-muted)]">
            {supportingText}
          </p>
        ) : null}

        <button
          className="min-h-14 w-full rounded-[1.35rem] bg-[var(--primary)] px-4 py-3 text-base font-semibold text-white shadow-[0_12px_28px_rgba(30,94,255,0.22)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(30,94,255,0.24)] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          disabled={disabled}
          onClick={onClick}
          type="button"
        >
          {label}
        </button>
      </div>
    </div>
  );
}
