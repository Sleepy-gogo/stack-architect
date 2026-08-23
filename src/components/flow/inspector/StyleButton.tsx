import { cn } from "@/lib/utils"

export function StyleButton({
  active,
  label,
  dashed,
  onClick,
}: {
  active: boolean
  label: string
  dashed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center justify-center gap-2 rounded-lg border text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border text-foreground hover:bg-muted",
      )}
    >
      <svg width="22" height="8" aria-hidden="true" className="shrink-0">
        <line
          x1="0"
          y1="4"
          x2="22"
          y2="4"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={dashed ? "4 3" : undefined}
        />
      </svg>
      {label}
    </button>
  )
}
