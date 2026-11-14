/** The exact promise the student agrees to. Shared by signup and Ajustes. */
const METRICS_CONSENT_LABEL = 'Ayudanos a mejorar: contamos clics, nunca lo que escribís'

export function MetricsConsentCheckbox({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="text-ink flex min-h-11 items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
      />
      {METRICS_CONSENT_LABEL}
    </label>
  )
}
