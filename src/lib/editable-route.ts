import { Position } from "@xyflow/react"
import { simplifyRoute, type RoutePoint } from "./orthogonal-route"

/** Full polyline, including its original endpoints, stored in flow coordinates. */
export function readRoute(value: unknown): RoutePoint[] | null {
  if (!Array.isArray(value) || value.length < 2 || value.length > 500) return null
  if (!value.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) return null
  if (value.some((p, i) => i > 0 && p.x !== value[i - 1].x && p.y !== value[i - 1].y)) return null
  const points = simplifyRoute(value)
  return points.length >= 2 ? points : null
}

export function routeSegments(points: RoutePoint[]) {
  return points.slice(0, -1).flatMap((a, index) => {
    const b = points[index + 1]
    if (a.x === b.x && a.y === b.y) return []
    return [{ index, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2,
      axis: a.y === b.y ? "y" as const : "x" as const,
      length: Math.abs(a.x - b.x) + Math.abs(a.y - b.y) }]
  })
}

/** Move a lane perpendicular to itself, leaving the two attachments fixed. */
export function moveRouteSegment(points: RoutePoint[], index: number, delta: number): RoutePoint[] {
  if (!delta || index < 0 || index >= points.length - 1) return points
  const next = points.map((p) => ({ ...p }))
  const a = next[index]
  const b = next[index + 1]
  const axis = a.y === b.y ? "y" : "x"
  const along = axis === "x" ? "y" : "x"
  const start = { ...a }
  const end = { ...b }
  // An end lane needs a short fixed exit before it can move sideways.
  const stub = Math.sign(b[along] - a[along]) * Math.min(24, Math.abs(b[along] - a[along]) / 3)
  a[axis] += delta
  b[axis] += delta
  if (index === 0) {
    a[along] += stub
    next.splice(0, 0, start, { ...start, [along]: a[along] })
  }
  if (index === points.length - 2) {
    b[along] -= stub
    next.push({ ...end, [along]: b[along] }, end)
  }
  return next
}

/** Add a movable detour in the middle third of a segment. */
export function addRouteBend(points: RoutePoint[], index: number): RoutePoint[] {
  const a = points[index]
  const b = points[index + 1]
  if (!a || !b) return points
  const axis = a.y === b.y ? "y" : "x"
  const first = { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 }
  const last = { x: a.x + (b.x - a.x) * 2 / 3, y: a.y + (b.y - a.y) * 2 / 3 }
  return [...points.slice(0, index + 1), first, { ...first, [axis]: first[axis] - 40 },
    { ...last, [axis]: last[axis] - 40 }, last, ...points.slice(index + 1)]
}

function attach(points: RoutePoint[], endpoint: RoutePoint, position: Position): RoutePoint[] {
  const next = points.map((p) => ({ ...p }))
  const axis = position === Position.Left || position === Position.Right ? "x" : "y"
  const cross = axis === "x" ? "y" : "x"
  const direction = position === Position.Left || position === Position.Top ? -1 : 1
  const old = next[0]
  const corner = next[1]
  next[0] = endpoint
  if (old[cross] === corner[cross] && (corner[axis] - endpoint[axis]) * direction >= 1) {
    corner[cross] = endpoint[cross]
    return next
  }
  const stub = { ...endpoint, [axis]: endpoint[axis] + direction * 24 }
  const elbow = { ...corner, [axis]: stub[axis] }
  return [endpoint, stub, elbow, ...next.slice(1)]
}

/** Keep manual lanes while reconnecting moved endpoints; move the whole route with a selection. */
export function resolveManualRoute(
  points: RoutePoint[], source: RoutePoint, target: RoutePoint,
  sourcePosition: Position, targetPosition: Position,
): RoutePoint[] {
  const first = points[0]
  const last = points[points.length - 1]
  const dx = source.x - first.x
  const dy = source.y - first.y
  if (Math.abs(target.x - last.x - dx) < 0.01 && Math.abs(target.y - last.y - dy) < 0.01) {
    return points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
  }
  // A straight line has no independent corners to keep fixed.
  const base = points.length === 2
    ? [first, { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 },
      { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 }, last]
    : points
  const fromSource = attach(base, source, sourcePosition)
  return simplifyRoute(attach(fromSource.toReversed(), target, targetPosition).toReversed())
}
