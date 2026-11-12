import { Position } from "@xyflow/react"
import type { Rect } from "./geometry"

export type RoutePoint = { x: number; y: number }

const STUB = 24
const CORNER_RADIUS = 10

function outward(position: Position): RoutePoint {
  if (position === Position.Left) return { x: -1, y: 0 }
  if (position === Position.Right) return { x: 1, y: 0 }
  if (position === Position.Top) return { x: 0, y: -1 }
  return { x: 0, y: 1 }
}

export function simplifyRoute(points: RoutePoint[]): RoutePoint[] {
  const unique = points.filter(
    (point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y,
  )
  return unique.filter((point, index) => {
    if (index === 0 || index === unique.length - 1) return true
    const previous = unique[index - 1]
    const next = unique[index + 1]
    return !(
      (previous.x === point.x && point.x === next.x && (point.y - previous.y) * (next.y - point.y) >= 0) ||
      (previous.y === point.y && point.y === next.y && (point.x - previous.x) * (next.x - point.x) >= 0)
    )
  })
}

function segmentCrossesRect(a: RoutePoint, b: RoutePoint, rect: Rect): boolean {
  if (a.x === b.x) {
    if (a.x <= rect.x || a.x >= rect.x + rect.w) return false
    const low = Math.min(a.y, b.y)
    const high = Math.max(a.y, b.y)
    return high > rect.y && low < rect.y + rect.h
  }
  if (a.y === b.y) {
    if (a.y <= rect.y || a.y >= rect.y + rect.h) return false
    const low = Math.min(a.x, b.x)
    const high = Math.max(a.x, b.x)
    return high > rect.x && low < rect.x + rect.w
  }
  return true
}

export type RouteSegment = { a: RoutePoint; b: RoutePoint }

/** Perpendicular segments that cross strictly inside both spans. */
function segmentsCross(a: RoutePoint, b: RoutePoint, c: RoutePoint, d: RoutePoint): boolean {
  const firstHorizontal = a.y === b.y
  const secondHorizontal = c.y === d.y
  if (firstHorizontal === secondHorizontal) return false
  const [h1, h2, v1, v2] = firstHorizontal ? [a, b, c, d] : [c, d, a, b]
  const x = v1.x
  const y = h1.y
  return x > Math.min(h1.x, h2.x) + 0.5 && x < Math.max(h1.x, h2.x) - 0.5 &&
    y > Math.min(v1.y, v2.y) + 0.5 && y < Math.max(v1.y, v2.y) - 0.5
}

/** Length two parallel segments share when they run on (nearly) the same lane. */
export function sharedLaneLength(a: RoutePoint, b: RoutePoint, c: RoutePoint, d: RoutePoint, tolerance = LANE_TOLERANCE): number {
  const firstHorizontal = a.y === b.y
  if (firstHorizontal !== (c.y === d.y)) return 0
  if (firstHorizontal ? Math.abs(a.y - c.y) > tolerance : Math.abs(a.x - c.x) > tolerance) return 0
  const [start, end, otherStart, otherEnd] = firstHorizontal ? [a.x, b.x, c.x, d.x] : [a.y, b.y, c.y, d.y]
  return Math.max(0, Math.min(Math.max(start, end), Math.max(otherStart, otherEnd)) - Math.max(Math.min(start, end), Math.min(otherStart, otherEnd)))
}

const LANE_TOLERANCE = 6
const CORRIDOR_MARGIN = 240
/** Distance from an existing arrow for a lane that runs beside it. */
const SIDE_LANE = 12

type ScoreContext = {
  obstacles: Rect[]
  /** Rects a route should avoid when it can, such as node labels. */
  soft: Rect[]
  /** Segments of arrows routed earlier. */
  routed: RouteSegment[]
}

/** Length, bends and hard crossings: a lower bound for the full score. */
function baseScore(points: RoutePoint[], obstacles: Rect[]): number {
  let length = 0
  let crossings = 0
  const box = boundsOf(points)
  const near = obstacles.filter((obstacle) =>
    obstacle.x < box.maxX && obstacle.x + obstacle.w > box.minX && obstacle.y < box.maxY && obstacle.y + obstacle.h > box.minY)
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    length += Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
    for (const obstacle of near) {
      if (segmentCrossesRect(a, b, obstacle)) crossings += 1
    }
  }
  return crossings * 1_000_000 + length + Math.max(0, points.length - 2) * 24
}

function boundsOf(points: RoutePoint[]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }
  return { minX, minY, maxX, maxY }
}

/** Penalties for labels and for other arrows, added to the base score. */
function contextPenalty(points: RoutePoint[], context: ScoreContext): number {
  const box = boundsOf(points)
  const near = (segment: RouteSegment) =>
    Math.max(segment.a.x, segment.b.x) >= box.minX - LANE_TOLERANCE && Math.min(segment.a.x, segment.b.x) <= box.maxX + LANE_TOLERANCE &&
    Math.max(segment.a.y, segment.b.y) >= box.minY - LANE_TOLERANCE && Math.min(segment.a.y, segment.b.y) <= box.maxY + LANE_TOLERANCE
  const routed = context.routed.filter(near)
  let penalty = 0
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    // The attachment segments must leave through their own node's label.
    if (index > 1 && index < points.length - 1) {
      for (const rect of context.soft) {
        if (segmentCrossesRect(a, b, rect)) penalty += 6_000
      }
    }
    for (const segment of routed) {
      if (segmentsCross(a, b, segment.a, segment.b)) penalty += 300
      const overlap = sharedLaneLength(a, b, segment.a, segment.b)
      if (overlap > 0) penalty += 400 + overlap * 8
    }
  }
  return penalty
}

export function roundedPath(points: RoutePoint[]): string {
  if (points.length === 0) return ""
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const current = points[index]
    const next = points[index + 1]
    const incoming = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y)
    const outgoing = Math.abs(next.x - current.x) + Math.abs(next.y - current.y)
    const radius = Math.min(CORNER_RADIUS, incoming / 2, outgoing / 2)
    const before = {
      x: current.x + Math.sign(previous.x - current.x) * radius,
      y: current.y + Math.sign(previous.y - current.y) * radius,
    }
    const after = {
      x: current.x + Math.sign(next.x - current.x) * radius,
      y: current.y + Math.sign(next.y - current.y) * radius,
    }
    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`
  }
  const last = points[points.length - 1]
  return `${path} L ${last.x} ${last.y}`
}

export function routeMidpoint(points: RoutePoint[]): RoutePoint {
  const lengths: number[] = []
  let total = 0
  for (let index = 1; index < points.length; index += 1) {
    const length =
      Math.abs(points[index].x - points[index - 1].x) +
      Math.abs(points[index].y - points[index - 1].y)
    lengths.push(length)
    total += length
  }
  let remaining = total / 2
  for (let index = 1; index < points.length; index += 1) {
    const length = lengths[index - 1]
    if (remaining <= length) {
      const ratio = length === 0 ? 0 : remaining / length
      return {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * ratio,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * ratio,
      }
    }
    remaining -= length
  }
  return points[points.length - 1]
}

/**
 * Pick the shortest low-bend orthogonal route that does not cross a card or
 * unrelated frame. Candidate lanes sit on the clearance edges supplied by the
 * caller. Earlier routes and soft obstacles steer the choice between lanes.
 */
export function getObstacleAvoidingPath(options: {
  source: RoutePoint
  target: RoutePoint
  sourcePosition: Position
  targetPosition: Position
  obstacles: Rect[]
  soft?: Rect[]
  routed?: RouteSegment[]
  /** How far each end runs straight out before turning. Defaults to 24. */
  sourceStub?: number
  targetStub?: number
}): [path: string, labelX: number, labelY: number, points: RoutePoint[]] {
  const { source, target, sourcePosition, targetPosition, obstacles } = options
  const context: ScoreContext = { obstacles, soft: options.soft ?? [], routed: options.routed ?? [] }
  const sourceVector = outward(sourcePosition)
  const targetVector = outward(targetPosition)
  const sourceLength = options.sourceStub ?? STUB
  const targetLength = options.targetStub ?? STUB
  const sourceStub = {
    x: source.x + sourceVector.x * sourceLength,
    y: source.y + sourceVector.y * sourceLength,
  }
  const targetStub = {
    x: target.x + targetVector.x * targetLength,
    y: target.y + targetVector.y * targetLength,
  }

  const xs = new Set<number>([sourceStub.x, targetStub.x, (sourceStub.x + targetStub.x) / 2])
  const ys = new Set<number>([sourceStub.y, targetStub.y, (sourceStub.y + targetStub.y) / 2])
  // Detours hug obstacles near the arrow's own corridor; lanes along distant
  // cards are never shorter, so they are not worth scoring.
  const corridor = boundsOf([source, target, sourceStub, targetStub])
  for (const obstacle of obstacles) {
    if (obstacle.x > corridor.maxX + CORRIDOR_MARGIN || obstacle.x + obstacle.w < corridor.minX - CORRIDOR_MARGIN ||
      obstacle.y > corridor.maxY + CORRIDOR_MARGIN || obstacle.y + obstacle.h < corridor.minY - CORRIDOR_MARGIN) continue
    xs.add(obstacle.x)
    xs.add(obstacle.x + obstacle.w)
    ys.add(obstacle.y)
    ys.add(obstacle.y + obstacle.h)
  }

  // Lanes beside arrows already in the corridor let this one tuck in next to
  // them instead of crossing them.
  for (const segment of context.routed) {
    const vertical = segment.a.x === segment.b.x
    const lane = vertical ? segment.a.x : segment.a.y
    const [low, high] = vertical ? [corridor.minX, corridor.maxX] : [corridor.minY, corridor.maxY]
    if (lane < low - SIDE_LANE || lane > high + SIDE_LANE) continue
    const [from, to] = vertical ? [segment.a.y, segment.b.y] : [segment.a.x, segment.b.x]
    const [spanLow, spanHigh] = vertical ? [corridor.minY, corridor.maxY] : [corridor.minX, corridor.maxX]
    if (Math.max(from, to) < spanLow || Math.min(from, to) > spanHigh) continue
    const lanes = vertical ? xs : ys
    lanes.add(lane - SIDE_LANE)
    lanes.add(lane + SIDE_LANE)
  }

  const innerCandidates: RoutePoint[][] = [
    [sourceStub, { x: targetStub.x, y: sourceStub.y }, targetStub],
    [sourceStub, { x: sourceStub.x, y: targetStub.y }, targetStub],
  ]
  // A straight shot needs no stubs; it only exists when the ends line up.
  const toward = { x: target.x - source.x, y: target.y - source.y }
  const lined = (source.x === target.x || source.y === target.y) &&
    toward.x * sourceVector.x + toward.y * sourceVector.y > 0 &&
    toward.x * targetVector.x + toward.y * targetVector.y < 0
  if (lined) innerCandidates.push([])
  for (const x of xs) {
    innerCandidates.push([
      sourceStub,
      { x, y: sourceStub.y },
      { x, y: targetStub.y },
      targetStub,
    ])
  }
  for (const y of ys) {
    innerCandidates.push([
      sourceStub,
      { x: sourceStub.x, y },
      { x: targetStub.x, y },
      targetStub,
    ])
  }

  // Cheap scores first; context penalties only for candidates that can win.
  const scored = innerCandidates.flatMap((inner) => {
    const candidate = simplifyRoute([source, ...inner, target])
    return isOrthogonal(candidate) ? [{ candidate, base: baseScore(candidate, obstacles) }] : []
  }).sort((a, b) => a.base - b.base)
  let best: RoutePoint[] | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const { candidate, base } of scored) {
    if (base >= bestScore) break
    const candidateScore = base + contextPenalty(candidate, context)
    if (candidateScore < bestScore) {
      best = candidate
      bestScore = candidateScore
    }
  }

  const points = best ?? [source, target]
  const label = routeMidpoint(points)
  return [roundedPath(points), label.x, label.y, points]
}

function isOrthogonal(points: RoutePoint[]): boolean {
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].x !== points[index - 1].x && points[index].y !== points[index - 1].y) return false
  }
  return true
}
