import { create } from "zustand"
import { estimateLabelBoxes, routeEdges, type EdgeRoute } from "./edge-routing"
import type { Rect } from "./geometry"
import type { AppEdge, AppNode } from "./types"

/**
 * Measured label line boxes per node, relative to the node's position. Kept
 * out of the document and its history: they are derived from the DOM, and only
 * change when a label's text or the fonts change, never while dragging.
 */
const boxes = new Map<string, Rect[]>()

export const useLabelMetrics = create<{ version: number }>(() => ({ version: 0 }))

const same = (a: Rect[] | undefined, b: Rect[]) =>
  a !== undefined && a.length === b.length &&
  a.every((box, index) => Math.abs(box.x - b[index].x) < 0.5 && Math.abs(box.y - b[index].y) < 0.5 &&
    Math.abs(box.w - b[index].w) < 0.5 && Math.abs(box.h - b[index].h) < 0.5)

export function setLabelBoxes(nodeId: string, next: Rect[]) {
  if (same(boxes.get(nodeId), next)) return
  boxes.set(nodeId, next)
  useLabelMetrics.setState((state) => ({ version: state.version + 1 }))
}

export function forgetLabelBoxes(nodeId: string) {
  if (!boxes.delete(nodeId)) return
  useLabelMetrics.setState((state) => ({ version: state.version + 1 }))
}

export function labelBoxesFor(node: AppNode): Rect[] | undefined {
  return boxes.get(node.id) ?? estimateLabelBoxes(node)
}

/** Above this many arrows, a drag routes them without avoiding each other. */
const FAST_DRAG_EDGES = 60
let dragging = false

/** The canvas reports drags so huge diagrams stay responsive while moving. */
export function setDragging(value: boolean) {
  if (dragging === value) return
  dragging = value
  // A finished drag needs the full pass even though nothing else changed.
  if (!value) useLabelMetrics.setState((state) => ({ version: state.version + 1 }))
}

let cache: { nodes: AppNode[]; edges: AppEdge[]; version: number; routes: Map<string, EdgeRoute> } | null = null

/**
 * Every edge component asks for the same routes, so the pass runs once per
 * change of nodes, edges or label metrics instead of once per edge.
 */
export function cachedRoutes(nodes: AppNode[], edges: AppEdge[], version: number): Map<string, EdgeRoute> {
  if (cache && cache.nodes === nodes && cache.edges === edges && cache.version === version) return cache.routes
  const aware = !(dragging && edges.length > FAST_DRAG_EDGES)
  const routes = routeEdges(nodes, edges, labelBoxesFor, { aware })
  cache = { nodes, edges, version, routes }
  return routes
}
