import { useReactFlow } from "@xyflow/react"
import { useStore } from "@/lib/store"
import { templates } from "@/lib/templates"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"

export function CanvasEmptyState() {
  const loadDocument = useStore((s) => s.loadDocument)
  const { fitView } = useReactFlow()

  const starter = templates[0]

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="pointer-events-auto max-w-sm rounded-2xl border border-border bg-card/95 p-6 text-center shadow-[0_2px_6px_-2px_rgb(15_23_42/0.12),0_18px_40px_-24px_rgb(15_23_42/0.5)] backdrop-blur-sm">
        <h2 className="text-base font-semibold text-foreground">Start your architecture</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Drag a service from the assets panel onto the canvas, or press{" "}
          <Kbd className="h-5">⌘K</Kbd> to search for one.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-xl"
          onClick={() => {
            loadDocument(starter.build())
            window.setTimeout(() => fitView({ padding: 0.18, duration: 300 }), 60)
          }}
        >
          Load the {starter.name} example
        </Button>
      </div>
    </div>
  )
}
