import { Position } from "@xyflow/react"
import { autoSide, faceOf, readNorm, resolveAnchor, SIDE_POSITIONS, type NormPoint, type Side } from "./edge-anchors.js"
import { anchorRect, type Rect } from "./geometry.js"
import type { AppEdge, AppNode } from "./types.js"

export type PortAnchor = { x: number; y: number; position: Position; side: Side; pinned: boolean }
export type EdgePorts = { source: PortAnchor; target: PortAnchor }

/** Preferred distance between neighbouring ports on one side. */
const PORT_GAP = 20
/** Rounded corners are no place for an arrowhead. */
const MAX_CORNER_INSET = 24
const STRAIGHTEN_PASSES = 3

const OPPOSITE: Record<Side, Side> = { left: "right", right: "left", top: "bottom", bottom: "top" }

function sideOf(position: Position): Side {
  if (position === Position.Left) return "left"
  if (position === Position.Right) return "right"
  if (position === Position.Top) return "top"
  return "bottom"
}

const isHorizontalSide = (side: Side) => side === "left" || side === "right"

/** Usable range along a side, in absolute flow coordinates. */
function sideSpan(rect: Rect, side: Side): [number, number] {
  const [start, length] = isHorizontalSide(side) ? [rect.y, rect.h] : [rect.x, rect.w]
  const inset = Math.min(length * 0.18, MAX_CORNER_INSET)
  return [start + inset, start + length - inset]
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** Two sides face each other with a clear gap between them. */
function facing(a: Rect, aSide: Side, b: Rect, bSide: Side): boolean {
  if (OPPOSITE[aSide] !== bSide) return false
  if (aSide === "right") return a.x + a.w <= b.x
  if (aSide === "left") return b.x + b.w <= a.x
  if (aSide === "bottom") return a.y + a.h <= b.y
  return b.y + b.h <= a.y
}

/**
 * Place sorted ports as close to their desired coordinates as possible while
 * keeping `gap` between neighbours. Colliding ports merge into clusters
 * centred on their wishes (a 1D pool-adjacent-violators pass).
 */
export function spreadPorts(desired: number[], low: number, high: number): number[] {
  const n = desired.length
  if (n === 0) return []
  if (high <= low) return desired.map(() => (low + high) / 2)
  const gap = n > 1 ? Math.min(PORT_GAP, (high - low) / (n - 1)) : 0
  type Cluster = { first: number; count: number }
  const position = (cluster: Cluster) => {
    let sum = 0
    for (let k = 0; k < cluster.count; k += 1) sum += desired[cluster.first + k] - k * gap
    return clamp(sum / cluster.count, low, high - (cluster.count - 1) * gap)
  }
  const clusters: Cluster[] = []
  for (let index = 0; index < n; index += 1) {
    clusters.push({ first: index, count: 1 })
    while (clusters.length > 1) {
      const last = clusters[clusters.length - 1]
      const previous = clusters[clusters.length - 2]
      const previousEnd = position(previous) + (previous.count - 1) * gap
      if (position(last) >= previousEnd + gap - 1e-6) break
      clusters.splice(clusters.length - 2, 2, { first: previous.first, count: previous.count + last.count })
    }
  }
  const result: number[] = []
  for (const cluster of clusters) {
    const start = position(cluster)
    for (let k = 0; k < cluster.count; k += 1) result.push(start + k * gap)
  }
  return result
}

/**
 * Sides for an arrow with two automatic ends. Cards in different columns
 * connect side to side, so any elbow runs in the gap between the columns;
 * cards in one column connect top to bottom.
 */
export function pairSides(source: Rect, target: Rect): { source: Side; target: Side } | null {
  const overlapY = source.y < target.y + target.h && target.y < source.y + source.h
  const overlapX = source.x < target.x + target.w && target.x < source.x + source.w
  if (overlapX && overlapY) return null
  if (!overlapX) {
    return target.x + target.w / 2 >= source.x + source.w / 2
      ? { source: "right", target: "left" }
      : { source: "left", target: "right" }
  }
  return target.y + target.h / 2 >= source.y + source.h / 2
    ? { source: "bottom", target: "top" }
    : { source: "top", target: "bottom" }
}

type End = {
  edgeId: string
  end: "source" | "target"
  nodeId: string
  otherId: string
  rect: Rect
  side: Side
  desired: number
  coordinate: number
}

/**
 * Choose every connection point in one pass. Pinned endpoints stay where the
 * user put them. Automatic ones prefer a coordinate that makes their arrow
 * straight, then spread apart so no two arrows share a point on a side.
 */
export function assignPorts(nodes: AppNode[], edges: AppEdge[], byId = new Map(nodes.map((node) => [node.id, node]))): Map<string, EdgePorts> {
  const result = new Map<string, EdgePorts>()
  const ends: End[] = []
  const pairs: { edgeId: string; source?: End; target?: End }[] = []

  for (const edge of edges) {
    const sourceNode = byId.get(edge.source)
    const targetNode = byId.get(edge.target)
    if (edge.hidden || !sourceNode || !targetNode || sourceNode.hidden || targetNode.hidden || edge.source === edge.target) continue
    const rects = { source: anchorRect(sourceNode, byId), target: anchorRect(targetNode, byId) }
    const center = (rect: Rect) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 })
    const pinned = { source: readNorm(edge.data?.sourcePoint), target: readNorm(edge.data?.targetPoint) }
    const ports: Partial<EdgePorts> = {}
    for (const end of ["source", "target"] as const) {
      const other = end === "source" ? "target" : "source"
      const point = pinned[end]
      if (point) {
        const anchor = resolveAnchor(rects[end], center(rects[other]), point)
        ports[end] = { ...anchor, side: sideOf(faceOf(rects[end], point)), pinned: true }
      }
    }
    const paired = !ports.source && !ports.target ? pairSides(rects.source, rects.target) : null
    const sides = {
      source: ports.source?.side ?? paired?.source ?? autoSide(rects.source, center(rects.target)),
      target: ports.target?.side ?? paired?.target ?? autoSide(rects.target, center(rects.source)),
    }
    const pair: (typeof pairs)[number] = { edgeId: edge.id }
    for (const end of ["source", "target"] as const) {
      if (ports[end]) continue
      const other = end === "source" ? "target" : "source"
      const side = sides[end]
      const horizontal = isHorizontalSide(side)
      const [low, high] = sideSpan(rects[end], side)
      const otherCenter = center(rects[other])
      let desired = horizontal ? otherCenter.y : otherCenter.x
      if (facing(rects[end], side, rects[other], sides[other])) {
        const pinnedOther = ports[other]
        if (pinnedOther) {
          desired = horizontal ? pinnedOther.y : pinnedOther.x
        } else {
          const [otherLow, otherHigh] = sideSpan(rects[other], sides[other])
          const overlapLow = Math.max(low, otherLow)
          const overlapHigh = Math.min(high, otherHigh)
          if (overlapLow <= overlapHigh) desired = (overlapLow + overlapHigh) / 2
        }
      }
      const entry: End = {
        edgeId: edge.id,
        end,
        nodeId: end === "source" ? edge.source : edge.target,
        otherId: end === "source" ? edge.target : edge.source,
        rect: rects[end],
        side,
        desired: clamp(desired, low, high),
        coordinate: 0,
      }
      ends.push(entry)
      pair[end] = entry
    }
    pairs.push(pair)
    result.set(edge.id, ports as EdgePorts)
  }

  const buckets = new Map<string, End[]>()
  for (const entry of ends) {
    const key = `${entry.nodeId}\u0000${entry.side}`
    const bucket = buckets.get(key) ?? []
    bucket.push(entry)
    buckets.set(key, bucket)
  }
  const orderedBuckets = [...buckets.keys()].sort().map((key) => buckets.get(key)!)

  const spreadAll = () => {
    for (const bucket of orderedBuckets) {
      bucket.sort((a, b) => a.desired - b.desired || a.otherId.localeCompare(b.otherId) || a.edgeId.localeCompare(b.edgeId))
      const [low, high] = sideSpan(bucket[0].rect, bucket[0].side)
      const placed = spreadPorts(bucket.map((entry) => entry.desired), low, high)
      bucket.forEach((entry, index) => { entry.coordinate = placed[index] })
    }
  }
  const bucketSize = (entry: End) => buckets.get(`${entry.nodeId}\u0000${entry.side}`)!.length

  // A crowded side may push a port off its straight line. Let the freer end
  // follow, so the arrow stays straight while the ports stay apart.
  spreadAll()
  for (let pass = 0; pass < STRAIGHTEN_PASSES; pass += 1) {
    let changed = false
    for (const { source, target } of pairs) {
      if (!source || !target || Math.abs(source.coordinate - target.coordinate) < 0.5) continue
      if (!facing(source.rect, source.side, target.rect, target.side)) continue
      const [sizeSource, sizeTarget] = [bucketSize(source), bucketSize(target)]
      const shared = sizeSource === sizeTarget
        ? (source.coordinate + target.coordinate) / 2
        : sizeSource > sizeTarget ? source.coordinate : target.coordinate
      for (const entry of [source, target]) {
        const [low, high] = sideSpan(entry.rect, entry.side)
        const next = clamp(shared, low, high)
        if (Math.abs(next - entry.desired) > 0.01) { entry.desired = next; changed = true }
      }
    }
    if (!changed) break
    spreadAll()
  }

  for (const entry of ends) {
    const horizontal = isHorizontalSide(entry.side)
    const { rect, side } = entry
    const anchor: PortAnchor = horizontal
      ? { x: side === "left" ? rect.x : rect.x + rect.w, y: entry.coordinate, position: SIDE_POSITIONS[side], side, pinned: false }
      : { x: entry.coordinate, y: side === "top" ? rect.y : rect.y + rect.h, position: SIDE_POSITIONS[side], side, pinned: false }
    const ports = result.get(entry.edgeId)!
    ports[entry.end] = anchor
  }
  return result
}

/** Normalized form of an absolute anchor, for pinning it to its node. */
export function anchorToNorm(rect: Rect, anchor: { x: number; y: number }): NormPoint {
  return { x: clamp((anchor.x - rect.x) / rect.w, 0, 1), y: clamp((anchor.y - rect.y) / rect.h, 0, 1) }
}
