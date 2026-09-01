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

function simplify(points: RoutePoint[]): RoutePoint[] {
  const unique = points.filter(
    (point, index) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y,
  )
  return unique.filter((point, index) => {
    if (index === 0 || index === unique.length - 1) return true
    const previous = unique[index - 1]
    const next = unique[index + 1]
    return !(
      (previous.x === point.x && point.x === next.x) ||
      (previous.y === point.y && point.y === next.y)
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

function score(points: RoutePoint[], obstacles: Rect[]): number {
  let length = 0
  let crossings = 0
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]
    const b = points[index]
    length += Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
    for (const obstacle of obstacles) {
      if (segmentCrossesRect(a, b, obstacle)) crossings += 1
    }
  }
  return crossings * 1_000_000 + length + Math.max(0, points.length - 2) * 18
}

function roundedPath(points: RoutePoint[]): string {
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

function midpoint(points: RoutePoint[]): RoutePoint {
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
 * unrelated frame. Candidate lanes sit on the clearance edges supplied by the caller.
 */
export function getObstacleAvoidingPath(options: {
  source: RoutePoint
  target: RoutePoint
  sourcePosition: Position
  targetPosition: Position
  obstacles: Rect[]
}): [path: string, labelX: number, labelY: number] {
  const { source, target, sourcePosition, targetPosition, obstacles } = options
  const sourceVector = outward(sourcePosition)
  const targetVector = outward(targetPosition)
  const sourceStub = {
    x: source.x + sourceVector.x * STUB,
    y: source.y + sourceVector.y * STUB,
  }
  const targetStub = {
    x: target.x + targetVector.x * STUB,
    y: target.y + targetVector.y * STUB,
  }

  const xs = new Set<number>([sourceStub.x, targetStub.x, (sourceStub.x + targetStub.x) / 2])
  const ys = new Set<number>([sourceStub.y, targetStub.y, (sourceStub.y + targetStub.y) / 2])
  for (const obstacle of obstacles) {
    xs.add(obstacle.x)
    xs.add(obstacle.x + obstacle.w)
    ys.add(obstacle.y)
    ys.add(obstacle.y + obstacle.h)
  }

  const innerCandidates: RoutePoint[][] = [
    [sourceStub, { x: targetStub.x, y: sourceStub.y }, targetStub],
    [sourceStub, { x: sourceStub.x, y: targetStub.y }, targetStub],
  ]
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

  let best: RoutePoint[] | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const inner of innerCandidates) {
    const candidate = simplify([source, ...inner, target])
    const candidateScore = score(candidate, obstacles)
    if (candidateScore < bestScore) {
      best = candidate
      bestScore = candidateScore
    }
  }

  const points = best ?? [source, target]
  const label = midpoint(points)
  return [roundedPath(points), label.x, label.y]
}
