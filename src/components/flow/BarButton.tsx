import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type BarButtonProps = {
  label: string
  disabled?: boolean
  disabledHint?: string
  onClick: () => void
  children: React.ReactNode
}

export function BarButton({ label, disabled, disabledHint, onClick, children }: BarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-disabled={disabled}
            onClick={() => {
              if (!disabled) onClick()
            }}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              disabled
                ? "cursor-not-allowed text-muted-foreground/40"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{disabled && disabledHint ? disabledHint : label}</TooltipContent>
    </Tooltip>
  )
}
