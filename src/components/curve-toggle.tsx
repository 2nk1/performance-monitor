type CurveToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Sichtbarer Text neben dem Schalter; ohne Text bleibt nur der Schalter. */
  label?: string;
  /** Vollständige Beschreibung für Screenreader. */
  description: string;
  color: string;
  disabled?: boolean;
};

/**
 * Schalter für eine Kurve im Diagramm. Der Zustand zeigt sich an Stellung und
 * Häkchen, nicht nur an der Farbe; ein Text daneben bleibt in beiden Zuständen gleich.
 */
export function CurveToggle({
  checked,
  onChange,
  label,
  description,
  color,
  disabled = false,
}: CurveToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={description}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex min-h-8 items-center gap-2 rounded-full px-1 text-xs text-foreground/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        aria-hidden
        className="relative inline-block h-5 w-9 shrink-0 rounded-full border transition-colors"
        style={{
          borderColor: color,
          background: checked ? color : "transparent",
        }}
      >
        <span
          className="absolute top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white transition-all"
          style={{ left: checked ? "1.125rem" : "0.125rem" }}
        >
          {checked ? (
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#222" strokeWidth="2">
              <path d="M2 5.2 4.2 7.4 8 2.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : null}
        </span>
      </span>
      {label}
    </button>
  );
}
