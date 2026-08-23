import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function QuickAdd({
  label,
  hint,
  icon,
  onClick,
}: {
  label: string
  hint: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            className="group flex flex-col items-center gap-1.5 rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors group-hover:border-foreground/20 group-hover:bg-muted">
              {icon}
            </span>
            <span className="text-[11px] leading-none font-medium text-muted-foreground transition-colors group-hover:text-foreground">
              {label}
            </span>
          </button>
        }
      />
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}
