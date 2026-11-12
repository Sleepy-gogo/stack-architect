import { ListIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { useStore } from "@/lib/store"
import { legendColor, legendItemsFromEdges, MAX_LEGEND_ITEMS } from "@/lib/legend"
import type { AppNode, LegendItem, LegendNodeData } from "@/lib/types"
import { InspectorHeader } from "./InspectorHeader"
import { Section } from "./Section"
import { Row } from "./Row"
import { Swatches } from "./Swatches"
import { StyleButton } from "./StyleButton"
import { IconButton } from "@/components/shared/IconButton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function LegendInspector({ node }: { node: AppNode }) {
  const d = node.data as LegendNodeData
  const edges = useStore((s) => s.edges)
  const updateNodeData = useStore((s) => s.updateNodeData)
  const deleteNode = useStore((s) => s.deleteNode)
  const duplicateNode = useStore((s) => s.duplicateNode)

  const setItems = (items: LegendItem[]) => updateNodeData(node.id, { items })
  const patchItem = (index: number, patch: Partial<LegendItem>) =>
    setItems(d.items.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <InspectorHeader
        icon={<ListIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
        title={d.title || "Legend"}
        kind="Legend"
        onDelete={() => deleteNode(node.id)}
        onDuplicate={() => duplicateNode(node.id)}
      />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto border-t border-border px-5 py-5">
        <Section title="Content">
          <Row label="Title" htmlFor="legend-title">
            <Input
              id="legend-title"
              value={d.title ?? ""}
              placeholder="Optional, e.g. Connections"
              onChange={(e) => updateNodeData(node.id, { title: e.target.value || undefined })}
              className="h-9 rounded-lg text-sm"
            />
          </Row>
        </Section>

        <Section title="Entries">
          {d.items.map((item, index) => (
            <div key={index} className="space-y-2.5 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Entry ${index + 1} label`}
                  value={item.label}
                  placeholder="What this line means"
                  onChange={(e) => patchItem(index, { label: e.target.value })}
                  className="h-8 rounded-lg text-sm"
                />
                <IconButton
                  label={`Remove entry ${index + 1}`}
                  destructive
                  onClick={() => setItems(d.items.filter((_, i) => i !== index))}
                  className="size-8 shrink-0"
                >
                  <Trash2Icon className="size-3.5" />
                </IconButton>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <StyleButton active={item.style !== "dashed"} label="Solid" dashed={false} onClick={() => patchItem(index, { style: "solid" })} />
                <StyleButton active={item.style === "dashed"} label="Dashed" dashed onClick={() => patchItem(index, { style: "dashed" })} />
              </div>
              <Swatches
                label={`Entry ${index + 1} color`}
                value={legendColor(item)}
                onChange={(hex) => patchItem(index, { color: hex })}
              />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={d.items.length >= MAX_LEGEND_ITEMS}
              onClick={() => setItems([...d.items, { label: "", style: "solid" }])}
            >
              <PlusIcon />
              Add entry
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={edges.length === 0}
              onClick={() => setItems(legendItemsFromEdges(edges))}
            >
              <RefreshCwIcon />
              From arrows
            </Button>
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            From arrows replaces the entries with one per line color and style on the canvas.
          </p>
        </Section>
      </div>
    </div>
  )
}
