import { useStore } from "@/lib/store"
import { EdgeInspector } from "./EdgeInspector"
import { EmptyInspector } from "./EmptyInspector"
import { FrameInspector } from "./FrameInspector"
import { MultiInspector } from "./MultiInspector"
import { TechInspector } from "./TechInspector"
import { TextInspector } from "./TextInspector"

export function Inspector() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const selectedNodeId = useStore((s) => s.selectedNodeId)
  const selectedEdgeId = useStore((s) => s.selectedEdgeId)

  const node = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined
  const edge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : undefined
  const multiCount = nodes.filter((n) => n.selected).length

  if (edge) return <EdgeInspector edge={edge} />
  if (!node && multiCount > 1) return <MultiInspector count={multiCount} />
  if (!node) return <EmptyInspector />
  if (node.type === "group") return <FrameInspector node={node} />
  if (node.type === "text") return <TextInspector node={node} />
  return <TechInspector node={node} />
}
