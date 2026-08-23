import dagre from "@dagrejs/dagre"
import { type AppEdge, type AppNode, type GraphDocument } from "./types"
import { nodeSize } from "./geometry"

/**
 * Hierarchical left-to-right layout.
 *
 * Only top-level objects are placed. Anything inside a frame keeps its position
 * relative to that frame, so arranging never scrambles the contents of a group.
 */
export function layoutDagre(doc: { nodes: AppNode[]; edges: AppEdge[] }): GraphDocument {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]))

  /** Walk up parentId until we reach an object that sits directly on the canvas. */
  const rootOf = (id: string): string => {
    let current = byId.get(id)
    const seen = new Set<string>()
    while (current?.parentId && !seen.has(current.id)) {
      seen.add(current.id)
      const parent = byId.get(current.parentId)
      if (!parent) break
      current = parent
    }
    return current?.id ?? id
  }

  const roots = doc.nodes.filter((n) => !n.parentId)
  if (roots.length === 0) return { version: 1, nodes: doc.nodes, edges: doc.edges }

  const g = new dagre.graphlib.Graph()
  // Generous gutters: edge labels ride on the lines between ranks, and frames
  // are much larger than the cards inside them, so cramped spacing reads as a
  // collision even when nothing actually overlaps.
  g.setGraph({ rankdir: "LR", nodesep: 96, ranksep: 190, marginx: 80, marginy: 80 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const node of roots) {
    const { w, h } = nodeSize(node)
    g.setNode(node.id, { width: w, height: h })
  }

  for (const edge of doc.edges) {
    const source = rootOf(edge.source)
    const target = rootOf(edge.target)
    if (source !== target && g.hasNode(source) && g.hasNode(target)) {
      g.setEdge(source, target)
    }
  }

  dagre.layout(g)

  const nodes = doc.nodes.map((node) => {
    if (node.parentId) return node
    const placed = g.node(node.id)
    if (!placed) return node
    const { w, h } = nodeSize(node)
    return {
      ...node,
      position: {
        x: Math.round(placed.x - w / 2),
        y: Math.round(placed.y - h / 2),
      },
    }
  })

  return { version: 1, nodes, edges: doc.edges }
}
