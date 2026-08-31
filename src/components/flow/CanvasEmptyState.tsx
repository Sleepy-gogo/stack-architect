import { useRef } from "react"
import { useReactFlow } from "@xyflow/react"
import { UploadIcon } from "lucide-react"
import { useStore } from "@/lib/store"
import { readJsonFile } from "@/lib/export"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { toast } from "@/components/ui/toast"

export function CanvasEmptyState() {
  const loadDocument = useStore((s) => s.loadDocument)
  const { fitView } = useReactFlow()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      loadDocument(await readJsonFile(file))
      window.setTimeout(() => fitView({ padding: 0.18, duration: 300 }), 60)
      toast.add({ type: "success", title: "Diagram imported" })
    } catch (error) {
      toast.add({
        type: "error",
        title: "Unable to import that file",
        description:
          error instanceof Error ? error.message : "Choose a JSON file exported by this editor.",
      })
    } finally {
      event.target.value = ""
    }
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="pointer-events-auto max-w-sm rounded-2xl border border-border bg-card/95 p-6 text-center shadow-[0_2px_6px_-2px_rgb(15_23_42/0.12),0_18px_40px_-24px_rgb(15_23_42/0.5)] backdrop-blur-sm">
        <h2 className="text-base font-semibold text-foreground">Start a diagram</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Drag a service from the assets panel onto the canvas, or press{" "}
          <Kbd className="h-5">⌘K</Kbd> to search for one.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImport}
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-4 rounded-xl"
          onClick={() => fileRef.current?.click()}
        >
          <UploadIcon className="size-4" aria-hidden="true" />
          Import JSON
        </Button>
      </div>
    </div>
  )
}
