import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

type IconButtonProps = {
  label: string
  onClick: () => void
  children: React.ReactNode
  hint?: string
  shortcut?: string
  pressed?: boolean
  destructive?: boolean
  disabled?: boolean
  side?: "top" | "bottom" | "left" | "right"
  className?: string
}

export function IconButton({
  label,
  onClick,
  children,
  hint,
  shortcut,
  pressed,
  destructive,
  disabled,
  side = "top",
  className,
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={pressed}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              "inline-flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-35",
              pressed && "text-foreground",
              destructive && "hover:bg-destructive/10 hover:text-destructive",
              className,
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={8}>
        <span>{hint ?? label}</span>
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  )
}
