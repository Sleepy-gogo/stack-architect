import { Trash2Icon } from "lucide-react"
import { useStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Section } from "./Section"

export function MultiInspector({ count }: { count: number }) {
  const alignSelection = useStore((s) => s.alignSelection)
  const distributeSelection = useStore((s) => s.distributeSelection)
  const deleteSelection = useStore((s) => s.deleteSelection)

  return (
    <div className="flex h-full flex-col">
      <header className="px-4 pt-4 pb-3">
        <p className="text-sm font-semibold text-foreground">{count} objects selected</p>
        <p className="text-xs text-muted-foreground">Align and distribute the selection</p>
      </header>
      <div className="space-y-4 border-t border-border px-5 py-5">
        <Section title="Align">
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ["left", "Left"],
                ["center-x", "Center"],
                ["right", "Right"],
                ["top", "Top"],
                ["center-y", "Middle"],
                ["bottom", "Bottom"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => alignSelection(id)}
                className="h-9 rounded-lg border border-border text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {label}
              </button>
            ))}
          </div>
        </Section>
        <Section title="Distribute">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => distributeSelection("horizontal")}
              disabled={count < 3}
              className="h-9 rounded-lg border border-border text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
            >
              Horizontally
            </button>
            <button
              type="button"
              onClick={() => distributeSelection("vertical")}
              disabled={count < 3}
              className="h-9 rounded-lg border border-border text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
            >
              Vertically
            </button>
          </div>
        </Section>
        <Button variant="destructive" size="sm" className="w-full" onClick={deleteSelection}>
          <Trash2Icon />
          Delete selection
        </Button>
      </div>
    </div>
  )
}
