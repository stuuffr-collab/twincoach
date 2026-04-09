type StickyActionBarProps = {
  label: string;
  disabled?: boolean;
  onClick?: () => void;
};

export function StickyActionBar({
  label,
  disabled = false,
  onClick,
}: StickyActionBarProps) {
  return (
    <div className="sticky bottom-0 mt-auto border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <button
        className="w-full rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {label}
      </button>
    </div>
  );
}
