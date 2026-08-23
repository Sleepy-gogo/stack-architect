export function NumberField({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string
  value: number
  onChange?: (value: number) => void
  readOnly?: boolean
}) {
  const id = `pos-${label.toLowerCase()}`
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
      <label htmlFor={id} className="font-mono text-[11px] text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="h-8 w-full min-w-0 bg-transparent font-mono text-xs text-foreground tabular-nums outline-none read-only:text-muted-foreground"
      />
    </div>
  )
}
