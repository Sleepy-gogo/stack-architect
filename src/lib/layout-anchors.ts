import { autoSide, type Side } from "./edge-anchors.js"
import { anchorRect } from "./geometry.js"
import type { AppEdge, AppNode, EdgeEndPoint } from "./types.js"

type Attachment = {
  edge: AppEdge
  end: "source" | "target"
  side: Side
  coordinate: number
  otherId: string
}

/** Reassign both ends after layout, sharing each side across incoming and outgoing edges. */
export function layoutEdgeAnchors(nodes: AppNode[], edges: AppEdge[]): AppEdge[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const buckets = new Map<string, Attachment[]>()
  const result = edges.map((edge) => {
    const { sourcePoint: _s, targetPoint: _t, labelX: _x, labelY: _y, routePoints: _r, ...data } = edge.data ?? {}
    return { ...edge, data }
  })
  for (const edge of result) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (edge.hidden || !source || !target || source.hidden || target.hidden || source === target) continue
    for (const end of ["source", "target"] as const) {
      const node = end === "source" ? source : target
      const other = end === "source" ? target : source
      const rect = anchorRect(node, byId)
      const otherRect = anchorRect(other, byId)
      const center = { x: otherRect.x + otherRect.w / 2, y: otherRect.y + otherRect.h / 2 }
      const side = autoSide(rect, center)
      const key = `${node.id}\u0000${side}`
      const bucket = buckets.get(key) ?? []
      bucket.push({ edge, end, side, coordinate: side === "left" || side === "right" ? center.y : center.x, otherId: other.id })
      buckets.set(key, bucket)
    }
  }
  for (const bucket of buckets.values()) {
    // The same ordering at both ends separates parallel and reciprocal edges.
    bucket.sort((a, b) => a.coordinate - b.coordinate || a.otherId.localeCompare(b.otherId) || a.edge.id.localeCompare(b.edge.id))
    bucket.forEach(({ edge, end, side }, index) => {
      // Keep ports away from rounded corners, with room for arrowheads.
      const offset = bucket.length === 1 ? 0.5 : 0.18 + 0.64 * (index + 0.5) / bucket.length
      const point: EdgeEndPoint = side === "left" || side === "right"
        ? { x: side === "left" ? 0 : 1, y: offset }
        : { x: offset, y: side === "top" ? 0 : 1 }
      edge.data = { ...edge.data, [`${end}Point`]: point }
      edge[`${end}Handle`] = side
    })
  }
  return result
}
