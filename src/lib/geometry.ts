import { NODE_HEIGHT, NODE_WIDTH, TECH_CARD_SIZE, type AppNode } from "./types"

export type Rect = { x: number; y: number; w: number; h: number }

export function nodeSize(node: AppNode): { w: number; h: number } {
  return {
    w: (node.width ?? (node.style?.width as number) ?? NODE_WIDTH) as number,
    h: (node.height ?? (node.style?.height as number) ?? NODE_HEIGHT) as number,
  }
}

/** Position of a node in flow space, walking up the parentId chain. */
export function absolutePosition(node: AppNode, byId: Map<string, AppNode>): {
  x: number
  y: number
} {
  let x = node.position.x
  let y = node.position.y
  const seen = new Set<string>()
  let parentId = node.parentId
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    parentId = parent.parentId
  }
  return { x, y }
}

export function absoluteRect(node: AppNode, byId: Map<string, AppNode>): Rect {
  const pos = absolutePosition(node, byId)
  const { w, h } = nodeSize(node)
  return { x: pos.x, y: pos.y, w, h }
}

/**
 * The surface arrows visually attach to: a tech node's icon card (not the
 * text bounds below it), or the full rect for every other node type.
 */
export function anchorRect(node: AppNode, byId: Map<string, AppNode>): Rect {
  const r = absoluteRect(node, byId)
  if (node.type === "tech") {
    return {
      x: r.x + (r.w - TECH_CARD_SIZE) / 2,
      y: r.y,
      w: TECH_CARD_SIZE,
      h: Math.min(TECH_CARD_SIZE, r.h),
    }
  }
  return r
}

/**
 * Topmost connectable object at the point. Nodes always beat frames, so a
 * drop aimed anywhere on a node inside a frame is never stolen by the frame;
 * frames only match empty frame area. A tech node's full bounds count in a
 * second pass, since its anchor surface is just the icon card.
 */
export function findConnectableAt(
  px: number,
  py: number,
  nodes: AppNode[],
  byId?: Map<string, AppNode>,
): AppNode | null {
  const map = byId ?? new Map(nodes.map((n) => [n.id, n]))
  let frameHit: AppNode | null = null
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const n = nodes[i]
    if (n.hidden || n.type === "text") continue
    if (n.type === "group") {
      if (!frameHit && pointInRect(px, py, absoluteRect(n, map))) frameHit = n
      continue
    }
    if (pointInRect(px, py, anchorRect(n, map))) return n
  }
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const n = nodes[i]
    if (n.hidden || n.type !== "tech") continue
    if (pointInRect(px, py, absoluteRect(n, map))) return n
  }
  return frameHit
}

export function rectsIntersect(a: Rect, b: Rect, pad = 0): boolean {
  return (
    a.x - pad < b.x + b.w &&
    a.x + a.w + pad > b.x &&
    a.y - pad < b.y + b.h &&
    a.y + a.h + pad > b.y
  )
}

export function rectContains(outer: Rect, inner: Rect, pad = 0): boolean {
  return (
    inner.x >= outer.x - pad &&
    inner.y >= outer.y - pad &&
    inner.x + inner.w <= outer.x + outer.w + pad &&
    inner.y + inner.h <= outer.y + outer.h + pad
  )
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

/**
 * Topmost frame whose area contains the point. Later siblings win, matching
 * what you see on screen (frames added later render above earlier ones).
 */
export function findFrameAt(
  px: number,
  py: number,
  nodes: AppNode[],
  byId?: Map<string, AppNode>,
): AppNode | null {
  const map = byId ?? new Map(nodes.map((n) => [n.id, n]))
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const n = nodes[i]
    if (n.type !== "group" || n.hidden) continue
    if (pointInRect(px, py, absoluteRect(n, map))) return n
  }
  return null
}

/**
 * Deepest frame that fully contains the given rect. Used when deciding whether
 * a dragged object should join (or leave) a frame.
 */
export function findEnclosingFrame(rect: Rect, nodes: AppNode[], ignoreIds: Set<string>): AppNode | null {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let best: AppNode | null = null
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const n = nodes[i]
    if (n.type !== "group" || n.hidden || ignoreIds.has(n.id)) continue
    if (!rectContains(absoluteRect(n, byId), rect, 12)) continue
    // Deepest wins: prefer a frame nested inside the current best.
    if (!best || isDescendant(n, best.id, byId)) best = n
  }
  return best
}

function isDescendant(node: AppNode, ancestorId: string, byId: Map<string, AppNode>): boolean {
  let parentId = node.parentId
  const seen = new Set<string>()
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    if (parentId === ancestorId) return true
    parentId = byId.get(parentId)?.parentId
  }
  return false
}
