import { TypeIcon } from "lucide-react"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { INK } from "@/lib/swatches"
import type { AppNode, TextNodeData } from "@/lib/types"
import { InspectorHeader } from "./InspectorHeader"
import { Section } from "./Section"
import { Row } from "./Row"
import { Swatches } from "./Swatches"
import { PositionFields } from "./PositionFields"
import { Textarea } from "@/components/ui/textarea"

const TEXT_SIZES: { id: NonNullable<TextNodeData["size"]>; label: string }[] = [
  { id: "sm", label: "Small" },
  { id: "md", label: "Medium" },
  { id: "lg", label: "Large" },
]

export function TextInspector({ node }: { node: AppNode }) {
  const d = node.data as TextNodeData
  const updateNodeData = useStore((s) => s.updateNodeData)
  const deleteNode = useStore((s) => s.deleteNode)
  const duplicateNode = useStore((s) => s.duplicateNode)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <InspectorHeader
        icon={<TypeIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
        title="Text"
        kind="Annotation"
        onDelete={() => deleteNode(node.id)}
        onDuplicate={() => duplicateNode(node.id)}
      />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto border-t border-border px-5 py-5">
        <Section title="Content">
          <Textarea
            aria-label="Text content"
            value={d.text}
            rows={4}
            placeholder="Floating label shown on the canvas…"
            onChange={(e) => updateNodeData(node.id, { text: e.target.value })}
            className="min-h-0 resize-y bg-input/50 text-sm leading-relaxed"
          />
        </Section>
        <Section title="Appearance">
          <Row label="Size">
            <div className="grid grid-cols-3 gap-1.5">
              {TEXT_SIZES.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  aria-pressed={(d.size ?? "md") === size.id}
                  onClick={() => updateNodeData(node.id, { size: size.id })}
                  className={cn(
                    "h-9 rounded-lg border text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    (d.size ?? "md") === size.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-foreground hover:bg-muted",
                  )}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Color">
            <Swatches
              value={d.color ?? INK}
              onChange={(hex) =>
                updateNodeData(
                  node.id,
                  hex === INK ? { color: undefined } : { color: hex },
                )
              }
            />
          </Row>
        </Section>
        <PositionFields node={node} />
      </div>
    </div>
  )
}
