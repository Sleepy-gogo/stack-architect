import { useStore as useFlowStore, useReactFlow } from "@xyflow/react"
import { MaximizeIcon, MinusIcon, PlusIcon } from "lucide-react"
import { IconButton } from "@/components/shared/IconButton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function ZoomBar() {
  const { zoomIn, zoomOut, fitView, zoomTo } = useReactFlow()
  const zoom = useFlowStore((s) => s.transform[2])
  const percent = Math.round(zoom * 100)

  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-border bg-card/95 p-1 shadow-[0_2px_6px_-2px_rgb(15_23_42/0.12),0_12px_28px_-16px_rgb(15_23_42/0.35)] backdrop-blur-sm">
      <IconButton
        label="Fit diagram to view"
        onClick={() => fitView({ padding: 0.18, duration: 250 })}
        className="size-8"
      >
        <MaximizeIcon className="size-4" />
      </IconButton>

      <div className="mx-0.5 h-5 w-px bg-border" />

      <IconButton label="Zoom out" onClick={() => zoomOut({ duration: 150 })} className="size-8">
        <MinusIcon className="size-4" />
      </IconButton>

      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => zoomTo(1, { duration: 200 })}
              aria-label={`Zoom level ${percent} percent. Activate to reset to 100 percent.`}
              className="h-8 min-w-[3.75rem] rounded-lg px-2 font-mono text-xs font-medium text-foreground tabular-nums transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
          }
        >
          {percent}%
        </TooltipTrigger>
        <TooltipContent>Reset to 100%</TooltipContent>
      </Tooltip>

      <IconButton label="Zoom in" onClick={() => zoomIn({ duration: 150 })} className="size-8">
        <PlusIcon className="size-4" />
      </IconButton>
    </div>
  )
}
