import { Position } from "@xyflow/react"

/** Side length units are flow coordinates; normalized points run 0–1 per axis. */
export type NormPoint = { x: number; y: number }

export type Anchor = { x: number; y: number; position: Position }

export type Side = "left" | "top" | "right" | "bottom"

type Rect = { x: number; y: number; w: number; h: number }

export const SIDE_POSITIONS: Record<Side, Position> = {
  left: Position.Left,
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
}

/** The four canonical connection points, normalized within the anchor rect. */
export const SIDE_POINTS: Record<Side, NormPoint> = {
  left: { x: 0, y: 0.5 },
  top: { x: 0.5, y: 0 },
  right: { x: 1, y: 0.5 },
  bottom: { x: 0.5, y: 1 },
}

/** Cursor distance at which a dragged endpoint snaps to a canonical point. */
const SNAP_RADIUS = 20

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

export function normToAbs(rect: Rect, p: NormPoint): { x: number; y: number } {
  return { x: rect.x + p.x * rect.w, y: rect.y + p.y * rect.h }
}

/** Radially project a point onto the rect's perimeter, normalized to 0–1. */
export function projectToPerimeter(rect: Rect, px: number, py: number): NormPoint {
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const dx = px - cx
  const dy = py - cy
  if (dx === 0 && dy === 0) return SIDE_POINTS.top
  const hx = dx !== 0 ? rect.w / 2 / Math.abs(dx) : Number.POSITIVE_INFINITY
  const hy = dy !== 0 ? rect.h / 2 / Math.abs(dy) : Number.POSITIVE_INFINITY
  const s = Math.min(hx, hy)
  return {
    x: clamp01((cx + dx * s - rect.x) / rect.w),
    y: clamp01((cy + dy * s - rect.y) / rect.h),
  }
}

/** Which face a normalized point sits closest to. */
export function faceOf(rect: Rect, p: NormPoint): Position {
  const dx = (p.x - 0.5) * rect.w
  const dy = (p.y - 0.5) * rect.h
  return Math.abs(dx) >= Math.abs(dy)
    ? dx >= 0
      ? Position.Right
      : Position.Left
    : dy >= 0
      ? Position.Bottom
      : Position.Top
}

/** Which canonical point (if any) this normalized position sits exactly on. */
export function sideFromNorm(p: NormPoint): Side | null {
  for (const [side, n] of Object.entries(SIDE_POINTS)) {
    if (Math.abs(n.x - p.x) < 1e-6 && Math.abs(n.y - p.y) < 1e-6) return side as Side
  }
  return null
}

/**
 * Which of the four sides faces the other node: dominant axis wins, so
 * horizontal neighbours exchange arrows left↔right and vertical ones
 * top↔bottom. Keeps exits and entries pinned to the four canonical points
 * unless the user has placed an endpoint by hand.
 */
export function autoSide(rect: Rect, towards: { x: number; y: number }): Side {
  const dx = towards.x - (rect.x + rect.w / 2)
  const dy = towards.y - (rect.y + rect.h / 2)
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? "right" : "left") : dy >= 0 ? "bottom" : "top"
}

export function resolveAnchor(
  rect: Rect,
  otherCenter: { x: number; y: number },
  point: NormPoint | null,
): Anchor {
  if (!point) {
    const side = autoSide(rect, otherCenter)
    const abs = normToAbs(rect, SIDE_POINTS[side])
    return { ...abs, position: SIDE_POSITIONS[side] }
  }
  return { ...normToAbs(rect, point), position: faceOf(rect, point) }
}

export function snapToSide(rect: Rect, px: number, py: number): NormPoint | null {
  let best: NormPoint | null = null
  let bestDist = SNAP_RADIUS
  for (const n of Object.values(SIDE_POINTS)) {
    const a = normToAbs(rect, n)
    const dist = Math.hypot(a.x - px, a.y - py)
    if (dist <= bestDist) {
      best = n
      bestDist = dist
    }
  }
  return best
}

export function readNorm(v: unknown): NormPoint | null {
  if (typeof v !== "object" || v === null) return null
  const p = v as { x?: unknown; y?: unknown }
  return typeof p.x === "number" && typeof p.y === "number" ? { x: p.x, y: p.y } : null
}
