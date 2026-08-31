import { absoluteRect, type Rect } from "./geometry"
import type { AppNode } from "./types"

export type AlignmentGuide = {
  kind: "alignment"
  axis: "x" | "y"
  value: number
  from: number
  to: number
}

export type GapGuide = {
  kind: "gap"
  axis: "x" | "y"
  from: number
  to: number
  cross: number
}

export type SmartGuide = AlignmentGuide | GapGuide

export type SmartSnap = {
  dx: number
  dy: number
  guides: SmartGuide[]
}

type Axis = "x" | "y"

type SnapCandidate = {
  delta: number
  guides: SmartGuide[]
  priority: number
}

const EPSILON = 0.01

function unionRects(rects: Rect[]): Rect {
  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.w))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.h))
  return { x: left, y: top, w: right - left, h: bottom - top }
}

function hasDraggedAncestor(node: AppNode, draggedIds: Set<string>, byId: Map<string, AppNode>): boolean {
  let parentId = node.parentId
  const seen = new Set<string>()
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    if (draggedIds.has(parentId)) return true
    parentId = byId.get(parentId)?.parentId
  }
  return false
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart
}

function axisValues(rect: Rect, axis: Axis): [number, number, number] {
  if (axis === "x") return [rect.x, rect.x + rect.w / 2, rect.x + rect.w]
  return [rect.y, rect.y + rect.h / 2, rect.y + rect.h]
}

function perpendicularSpan(rect: Rect, axis: Axis): [number, number] {
  return axis === "x" ? [rect.y, rect.y + rect.h] : [rect.x, rect.x + rect.w]
}

function alignmentCandidates(
  moving: Rect,
  targets: Rect[],
  axis: Axis,
  threshold: number,
): SnapCandidate[] {
  const candidates: SnapCandidate[] = []
  const movingValues = axisValues(moving, axis)

  for (const target of targets) {
    const targetValues = axisValues(target, axis)
    for (const movingValue of movingValues) {
      for (const targetValue of targetValues) {
        const delta = targetValue - movingValue
        if (Math.abs(delta) > threshold) continue
        const [movingFrom, movingTo] = perpendicularSpan(moving, axis)
        const [targetFrom, targetTo] = perpendicularSpan(target, axis)
        candidates.push({
          delta,
          priority: 0,
          guides: [
            {
              kind: "alignment",
              axis,
              value: targetValue,
              from: Math.min(movingFrom, targetFrom),
              to: Math.max(movingTo, targetTo),
            },
          ],
        })
      }
    }
  }
  return candidates
}

function axisRect(rect: Rect, axis: Axis) {
  return axis === "x"
    ? { start: rect.x, end: rect.x + rect.w, size: rect.w, crossStart: rect.y, crossEnd: rect.y + rect.h }
    : { start: rect.y, end: rect.y + rect.h, size: rect.h, crossStart: rect.x, crossEnd: rect.x + rect.w }
}

function gapGuide(axis: Axis, from: number, to: number, moving: Rect, target: Rect): GapGuide {
  const movingCross = perpendicularSpan(moving, axis)
  const targetCross = perpendicularSpan(target, axis)
  const overlapStart = Math.max(movingCross[0], targetCross[0])
  const overlapEnd = Math.min(movingCross[1], targetCross[1])
  return {
    kind: "gap",
    axis,
    from,
    to,
    cross: overlapStart < overlapEnd ? (overlapStart + overlapEnd) / 2 : (movingCross[0] + movingCross[1]) / 2,
  }
}

function gapCandidates(
  moving: Rect,
  targets: Rect[],
  axis: Axis,
  threshold: number,
): SnapCandidate[] {
  const candidates: SnapCandidate[] = []
  const movingAxis = axisRect(moving, axis)
  const relevant = targets.filter((target) => {
    const item = axisRect(target, axis)
    return overlaps(movingAxis.crossStart, movingAxis.crossEnd, item.crossStart, item.crossEnd)
  })

  for (const left of relevant) {
    const leftAxis = axisRect(left, axis)
    if (leftAxis.end > movingAxis.start + threshold) continue
    for (const right of relevant) {
      if (right === left) continue
      const rightAxis = axisRect(right, axis)
      if (rightAxis.start < movingAxis.end - threshold) continue
      const available = rightAxis.start - leftAxis.end
      if (available < movingAxis.size) continue
      const snappedStart = leftAxis.end + (available - movingAxis.size) / 2
      const delta = snappedStart - movingAxis.start
      if (Math.abs(delta) > threshold) continue
      candidates.push({
        delta,
        priority: 1,
        guides: [
          gapGuide(axis, leftAxis.end, snappedStart, moving, left),
          gapGuide(axis, snappedStart + movingAxis.size, rightAxis.start, moving, right),
        ],
      })
    }
  }

  for (const near of relevant) {
    const nearAxis = axisRect(near, axis)

    if (nearAxis.end <= movingAxis.start + threshold) {
      for (const far of relevant) {
        if (far === near) continue
        const farAxis = axisRect(far, axis)
        if (farAxis.end > nearAxis.start) continue
        const gap = nearAxis.start - farAxis.end
        const snappedStart = nearAxis.end + gap
        const delta = snappedStart - movingAxis.start
        if (gap < 0 || Math.abs(delta) > threshold) continue
        candidates.push({
          delta,
          priority: 2,
          guides: [
            gapGuide(axis, farAxis.end, nearAxis.start, near, far),
            gapGuide(axis, nearAxis.end, snappedStart, moving, near),
          ],
        })
      }
    }

    if (nearAxis.start >= movingAxis.end - threshold) {
      for (const far of relevant) {
        if (far === near) continue
        const farAxis = axisRect(far, axis)
        if (farAxis.start < nearAxis.end) continue
        const gap = farAxis.start - nearAxis.end
        const snappedStart = nearAxis.start - gap - movingAxis.size
        const delta = snappedStart - movingAxis.start
        if (gap < 0 || Math.abs(delta) > threshold) continue
        candidates.push({
          delta,
          priority: 2,
          guides: [
            gapGuide(axis, snappedStart + movingAxis.size, nearAxis.start, moving, near),
            gapGuide(axis, nearAxis.end, farAxis.start, near, far),
          ],
        })
      }
    }
  }

  return candidates
}

function bestCandidate(candidates: SnapCandidate[]): SnapCandidate | null {
  if (candidates.length === 0) return null
  candidates.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta) || a.priority - b.priority)
  const best = candidates[0]

  const matching = candidates.filter((candidate) => Math.abs(candidate.delta - best.delta) < EPSILON)
  return {
    ...best,
    guides: matching.flatMap((candidate) => candidate.guides),
  }
}

function dedupeGuides(guides: SmartGuide[]): SmartGuide[] {
  const seen = new Set<string>()
  return guides.filter((guide) => {
    const key =
      guide.kind === "alignment"
        ? `${guide.kind}:${guide.axis}:${guide.value}:${guide.from}:${guide.to}`
        : `${guide.kind}:${guide.axis}:${guide.from}:${guide.to}:${guide.cross}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function computeSmartSnap(
  nodes: AppNode[],
  draggedNodeIds: string[],
  threshold: number,
): SmartSnap | null {
  if (draggedNodeIds.length === 0) return null
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const draggedIds = new Set(draggedNodeIds)
  const movingNodes = nodes.filter(
    (node) => draggedIds.has(node.id) && !hasDraggedAncestor(node, draggedIds, byId),
  )
  if (movingNodes.length === 0) return null

  const ignoredIds = new Set(draggedIds)
  for (const node of nodes) {
    if (hasDraggedAncestor(node, draggedIds, byId)) ignoredIds.add(node.id)
  }

  const moving = unionRects(movingNodes.map((node) => absoluteRect(node, byId)))
  const targets = nodes
    .filter((node) => !node.hidden && !ignoredIds.has(node.id))
    .map((node) => absoluteRect(node, byId))
  if (targets.length === 0) return null

  const x = bestCandidate([
    ...alignmentCandidates(moving, targets, "x", threshold),
    ...gapCandidates(moving, targets, "x", threshold),
  ])
  const y = bestCandidate([
    ...alignmentCandidates(moving, targets, "y", threshold),
    ...gapCandidates(moving, targets, "y", threshold),
  ])
  if (!x && !y) return null

  return {
    dx: x?.delta ?? 0,
    dy: y?.delta ?? 0,
    guides: dedupeGuides([...(x?.guides ?? []), ...(y?.guides ?? [])]),
  }
}
