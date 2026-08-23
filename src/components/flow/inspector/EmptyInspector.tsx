import { MousePointerSquareDashedIcon } from "lucide-react"

export function EmptyInspector() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl border border-dashed border-border text-muted-foreground">
        <MousePointerSquareDashedIcon className="size-5" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Nothing selected</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Pick a node, frame or connection on the canvas and its properties show up here.
        </p>
      </div>
    </div>
  )
}
