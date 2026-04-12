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
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3">
        {supportingText ? (
          <p className="mb-3 text-xs leading-5 text-[var(--text-muted)]">
            {supportingText}
          </p>
        ) : null}

        <button
          className="min-h-14 w-full rounded-2xl bg-[var(--primary)] px-4 py-3 text-base font-semibold text-white shadow-[0_12px_28px_rgba(29,78,216,0.22)] transition disabled:cursor-not-allowed disabled:opacity-60"
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
