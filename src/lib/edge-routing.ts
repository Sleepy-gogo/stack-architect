import { Position } from "@xyflow/react"
import { readRoute, resolveManualRoute } from "./editable-route.js"
import { absolutePosition, absoluteRect, anchorRect, type Rect } from "./geometry.js"
import { getObstacleAvoidingPath, sharedLaneLength, type RoutePoint, type RouteSegment } from "./orthogonal-route.js"
import { assignPorts, type PortAnchor } from "./ports.js"
import { estimateCardLabelBoxes } from "./label-text.js"
import type { AppEdge, AppNode } from "./types.js"

export type EdgeRoute = {
  points: RoutePoint[]
  source: PortAnchor
  target: PortAnchor
  /** Label boxes the stroke passes behind; the renderer leaves a gap there. */
  gaps: Rect[]
}

/** Label line boxes relative to the node's position. */
export type LabelBoxes = (node: AppNode) => Rect[] | undefined

const ROUTE_CLEARANCE = 16
const DEFAULT_STUB = 24
/** Room between the bottom of a label and the first turn below it. */
const LABEL_STUB_CLEARANCE = 14
const LANE_GAP = 10
const LANE_TOLERANCE = 6
const GAP_PAD_X = 3
const GAP_PAD_Y = 1

/**
 * Server-side stand-in for measured labels: name and subtitle each wrap to at
 * most two centered lines under the card. The editor replaces this with DOM
 * measurements.
 */
export function estimateLabelBoxes(node: AppNode): Rect[] | undefined {
  if (node.type !== "tech") return undefined
  return estimateCardLabelBoxes(node.data as { name?: unknown; subtitle?: unknown })
}

function ancestry(id: string, byId: Map<string, AppNode>): Set<string> {
  const family = new Set<string>([id])
  let parentId = byId.get(id)?.parentId
  while (parentId && !family.has(parentId)) {
    family.add(parentId)
    parentId = byId.get(parentId)?.parentId
  }
  return family
}

/** Cards and frames an arrow between these two nodes must not cross. */
export function routeObstacles(sourceId: string, targetId: string, nodes: AppNode[], byId: Map<string, AppNode>): Rect[] {
  return obstaclesExcept(paddedRects(nodes, byId), sourceId, targetId, byId)
}

type Padded = { id: string; rect: Rect }

function paddedRects(nodes: AppNode[], byId: Map<string, AppNode>): Padded[] {
  return nodes.flatMap((node) => {
    if (node.hidden || node.type === "text" || node.type === "legend") return []
    const rect = absoluteRect(node, byId)
    return [{ id: node.id, rect: {
      x: rect.x - ROUTE_CLEARANCE,
      y: rect.y - ROUTE_CLEARANCE,
      w: rect.w + ROUTE_CLEARANCE * 2,
      h: rect.h + ROUTE_CLEARANCE * 2,
    } }]
  })
}

function obstaclesExcept(padded: Padded[], sourceId: string, targetId: string, byId: Map<string, AppNode>): Rect[] {
  const family = new Set([...ancestry(sourceId, byId), ...ancestry(targetId, byId)])
  return padded.flatMap((entry) => (family.has(entry.id) ? [] : [entry.rect]))
}

function absoluteLabels(node: AppNode, byId: Map<string, AppNode>, labelBoxes: LabelBoxes): Rect[] {
  const boxes = labelBoxes(node)
  if (!boxes?.length) return []
  const origin = absolutePosition(node, byId)
  return boxes.map((box) => ({ x: origin.x + box.x, y: origin.y + box.y, w: box.w, h: box.h }))
}

/** A bottom exit has to clear the node's own label before it may turn. */
export function stubLength(node: AppNode | undefined, position: Position, byId: Map<string, AppNode>, labelBoxes: LabelBoxes): number {
  if (!node || node.type !== "tech" || position !== Position.Bottom) return DEFAULT_STUB
  const labels = absoluteLabels(node, byId, labelBoxes)
  if (labels.length === 0) return DEFAULT_STUB
  const card = anchorRect(node, byId)
  const labelBottom = Math.max(...labels.map((box) => box.y + box.h))
  return Math.max(DEFAULT_STUB, labelBottom - (card.y + card.h) + LABEL_STUB_CLEARANCE)
}

function crossesRect(a: RoutePoint, b: RoutePoint, rect: Rect): boolean {
  if (a.x === b.x) return a.x > rect.x && a.x < rect.x + rect.w && Math.max(a.y, b.y) > rect.y && Math.min(a.y, b.y) < rect.y + rect.h
  if (a.y === b.y) return a.y > rect.y && a.y < rect.y + rect.h && Math.max(a.x, b.x) > rect.x && Math.min(a.x, b.x) < rect.x + rect.w
  return false
}

export function labelGaps(points: RoutePoint[], labels: Rect[]): Rect[] {
  const gaps: Rect[] = []
  for (const label of labels) {
    for (let index = 1; index < points.length; index += 1) {
      if (!crossesRect(points[index - 1], points[index], label)) continue
      gaps.push({ x: label.x - GAP_PAD_X, y: label.y - GAP_PAD_Y, w: label.w + GAP_PAD_X * 2, h: label.h + GAP_PAD_Y * 2 })
      break
    }
  }
  return gaps
}

type Lane = { route: RoutePoint[]; index: number; obstacles: Rect[]; horizontal: boolean; coordinate: number; low: number; high: number }

/**
 * Separate arrows that ended up sharing a lane. Only interior segments move,
 * so the attachment points and the turns' order along each lane are kept.
 */
function separateLanes(routes: { points: RoutePoint[]; obstacles: Rect[] }[]) {
  const lanes: Lane[] = []
  for (const { points, obstacles } of routes) {
    for (let index = 1; index < points.length - 2; index += 1) {
      const a = points[index]
      const b = points[index + 1]
      const horizontal = a.y === b.y
      lanes.push({
        route: points, index, obstacles, horizontal,
        coordinate: horizontal ? a.y : a.x,
        low: horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
        high: horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y),
      })
    }
  }
  const seen = new Set<Lane>()
  for (const lane of lanes) {
    if (seen.has(lane)) continue
    const group = [lane]
    seen.add(lane)
    for (let cursor = 0; cursor < group.length; cursor += 1) {
      const current = group[cursor]
      for (const other of lanes) {
        if (seen.has(other) || other.horizontal !== current.horizontal || other.route === current.route) continue
        if (Math.abs(other.coordinate - current.coordinate) > LANE_TOLERANCE) continue
        if (Math.min(other.high, current.high) - Math.max(other.low, current.low) <= 0) continue
        seen.add(other)
        group.push(other)
      }
    }
    if (group.length < 2) continue
    const axis = lane.horizontal ? "y" : "x"
    // Members whose turns head toward lower coordinates take the lower lanes.
    const lean = (member: Lane) => (member.route[member.index - 1][axis] + member.route[member.index + 2][axis]) / 2
    group.sort((a, b) => lean(a) - lean(b))
    const center = group.reduce((sum, member) => sum + member.coordinate, 0) / group.length
    group.forEach((member, order) => {
      const next = center + (order - (group.length - 1) / 2) * LANE_GAP
      const points = member.route
      const before = { a: { ...points[member.index] }, b: { ...points[member.index + 1] } }
      points[member.index][axis] = next
      points[member.index + 1][axis] = next
      const touched = [member.index - 1, member.index, member.index + 1]
      const blocked = touched.some((segment) =>
        member.obstacles.some((rect) => crossesRect(points[segment], points[segment + 1], rect)))
      if (blocked) {
        points[member.index] = before.a
        points[member.index + 1] = before.b
      }
    })
  }
}

/**
 * Route every visible arrow in one pass. Ports are shared out first, then
 * arrows are routed in a fixed order so later ones avoid earlier ones.
 */
export function routeEdges(
  nodes: AppNode[],
  edges: AppEdge[],
  labelBoxes: LabelBoxes = estimateLabelBoxes,
  /** Skip avoiding other arrows: a cheaper pass for dragging very large diagrams. */
  options: { aware?: boolean } = {},
): Map<string, EdgeRoute> {
  const aware = options.aware ?? true
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const ports = assignPorts(nodes, edges, byId)
  const labels = new Map<string, Rect[]>()
  for (const node of nodes) {
    if (node.hidden || node.type !== "tech") continue
    labels.set(node.id, absoluteLabels(node, byId, labelBoxes))
  }
  const allLabels = [...labels.values()].flat()

  const length = (edge: AppEdge) => {
    const end = ports.get(edge.id)!
    return Math.abs(end.source.x - end.target.x) + Math.abs(end.source.y - end.target.y)
  }
  const ordered = edges.filter((edge) => ports.has(edge.id)).sort((a, b) => {
    const manual = Number(!readRoute(a.data?.routePoints)) - Number(!readRoute(b.data?.routePoints))
    const dashed = Number(a.data?.style === "dashed") - Number(b.data?.style === "dashed")
    return manual || dashed || length(a) - length(b) || a.id.localeCompare(b.id)
  })

  const padded = paddedRects(nodes, byId)
  const routed: RouteSegment[] = []
  const automatic: { points: RoutePoint[]; obstacles: Rect[] }[] = []
  const result = new Map<string, EdgeRoute>()
  for (const edge of ordered) {
    const { source, target } = ports.get(edge.id)!
    const manual = readRoute(edge.data?.routePoints)
    let points: RoutePoint[]
    if (manual) {
      points = resolveManualRoute(manual, source, target, source.position, target.position)
    } else {
      const obstacles = obstaclesExcept(padded, edge.source, edge.target, byId)
      points = getObstacleAvoidingPath({
        source, target,
        sourcePosition: source.position,
        targetPosition: target.position,
        obstacles,
        soft: [...(labels.get(edge.source) ?? []), ...(labels.get(edge.target) ?? [])],
        routed: aware ? routed : [],
        sourceStub: stubLength(byId.get(edge.source), source.position, byId, labelBoxes),
        targetStub: stubLength(byId.get(edge.target), target.position, byId, labelBoxes),
      })[3].map((point) => ({ ...point }))
      automatic.push({ points, obstacles })
    }
    for (let index = 1; index < points.length; index += 1) routed.push({ a: points[index - 1], b: points[index] })
    result.set(edge.id, { points, source, target, gaps: [] })
  }

  separateLanes(automatic)
  for (const route of result.values()) route.gaps = labelGaps(route.points, allLabels)
  return result
}

/* ---------- Quality metrics ---------- */

export type RouteQuality = {
  edges: number
  straight: number
  bends: number
  /** Interior segments shorter than 16px: visible kinks. */
  jogs: number
  /** Segments passing through a label other than the arrow's own exit. */
  throughLabels: number
  crossings: number
  /** Total length where two arrows run on the same lane. */
  sharedLane: number
}

export function measureRoutes(routes: Map<string, EdgeRoute>, nodes: AppNode[], labelBoxes: LabelBoxes = estimateLabelBoxes): RouteQuality {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const labelRects = nodes.filter((node) => node.type === "tech" && !node.hidden)
    .flatMap((node) => absoluteLabels(node, byId, labelBoxes))
  const all = [...routes.values()]
  const quality: RouteQuality = { edges: all.length, straight: 0, bends: 0, jogs: 0, throughLabels: 0, crossings: 0, sharedLane: 0 }
  for (const { points } of all) {
    const bends = points.length - 2
    quality.bends += bends
    if (bends === 0) quality.straight += 1
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1]
      const b = points[index]
      const interior = index > 1 && index < points.length - 1
      if (interior && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 16) quality.jogs += 1
      if (interior && labelRects.some((rect) => crossesRect(a, b, rect))) quality.throughLabels += 1
    }
  }
  for (let i = 0; i < all.length; i += 1) {
    for (let j = i + 1; j < all.length; j += 1) {
      const first = all[i].points
      const second = all[j].points
      for (let p = 1; p < first.length; p += 1) {
        for (let q = 1; q < second.length; q += 1) {
          const [a, b, c, d] = [first[p - 1], first[p], second[q - 1], second[q]]
          quality.sharedLane += sharedLaneLength(a, b, c, d, 2)
          const ah = a.y === b.y
          if (ah === (c.y === d.y)) continue
          const [h1, h2, v1, v2] = ah ? [a, b, c, d] : [c, d, a, b]
          if (v1.x > Math.min(h1.x, h2.x) + 0.5 && v1.x < Math.max(h1.x, h2.x) - 0.5 &&
            h1.y > Math.min(v1.y, v2.y) + 0.5 && h1.y < Math.max(v1.y, v2.y) - 0.5) quality.crossings += 1
        }
      }
    }
  }
  quality.sharedLane = Math.round(quality.sharedLane)
  return quality
}
