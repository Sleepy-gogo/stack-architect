import { ArrowLeftRightIcon } from "lucide-react"
import { useStore } from "@/lib/store"
import { nodeLabel } from "@/lib/node-labels"
import type { AppEdge, TechEdgeData } from "@/lib/types"
import { EDGE_DASHED, EDGE_SOLID } from "@/lib/types"
import { InspectorHeader } from "./InspectorHeader"
import { Section } from "./Section"
import { Row } from "./Row"
import { Swatches } from "./Swatches"
import { StyleButton } from "./StyleButton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function EdgeInspector({ edge }: { edge: AppEdge }) {
  const d = (edge.data ?? {}) as TechEdgeData
  const nodes = useStore((s) => s.nodes)
  const updateEdge = useStore((s) => s.updateEdge)
  const deleteEdge = useStore((s) => s.deleteEdge)
  const loadDocument = useStore((s) => s.loadDocument)
  const edges = useStore((s) => s.edges)

  const currentColor = d.colorOverride ?? (d.style === "dashed" ? EDGE_DASHED : EDGE_SOLID)

  const reverse = () => {
    loadDocument({
      version: 1,
      nodes,
      edges: edges.map((e) =>
        e.id === edge.id
          ? {
              ...e,
              source: e.target,
              target: e.source,
              sourceHandle: e.targetHandle,
              targetHandle: e.sourceHandle,
            }
          : e,
      ),
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <InspectorHeader
        icon={
          <svg width="18" height="10" aria-hidden="true">
            <line
              x1="1"
              y1="5"
              x2="17"
              y2="5"
              stroke={currentColor}
              strokeWidth="2"
              strokeDasharray={d.style === "dashed" ? "4 3" : undefined}
            />
          </svg>
        }
        title={`${nodeLabel(nodes.find((n) => n.id === edge.source))} → ${nodeLabel(
          nodes.find((n) => n.id === edge.target),
        )}`}
        kind="Connection"
        onDelete={() => deleteEdge(edge.id)}
      />

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto border-t border-border px-5 py-5">
        <Section title="Content">
          <Row label="Label" htmlFor="edge-label">
            <Input
              id="edge-label"
              value={d.label ?? ""}
              placeholder="e.g. HTTPS, query, SQL"
              onChange={(e) => updateEdge(edge.id, { label: e.target.value })}
              className="h-9 rounded-lg text-sm"
            />
          </Row>
          <p className="-mt-2 text-[11px] leading-snug text-muted-foreground">
            Drag the label on the canvas to place it by hand; double-click it to
            return to automatic placement.
          </p>
          <Row label="Direction">
            <Button variant="outline" size="xs" onClick={reverse} className="w-full">
              <ArrowLeftRightIcon />
              Reverse
            </Button>
          </Row>
        </Section>

        <Section title="Appearance">
          <Row label="Line">
            <div className="grid grid-cols-2 gap-1.5">
              <StyleButton
                active={d.style !== "dashed"}
                label="Solid"
                dashed={false}
                onClick={() => updateEdge(edge.id, { style: "solid" })}
              />
              <StyleButton
                active={d.style === "dashed"}
                label="Dashed"
                dashed
                onClick={() => updateEdge(edge.id, { style: "dashed" })}
              />
            </div>
          </Row>
          <Row label="Color">
            <Swatches
              value={currentColor}
              onChange={(hex) => updateEdge(edge.id, { colorOverride: hex })}
            />
          </Row>
        </Section>
      </div>
    </div>
  )
}
