import type { AppNode } from "./types"
import { absoluteRect, rectContains, rectsIntersect, type Rect } from "./geometry"

/** Small margin so measured collision bounds slightly exceed the glyphs. */
const LABEL_MARGIN_X = 4
const LABEL_HEIGHT = 13
const LABEL_FONT = "600 11.5px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
/** How close a label may sit to a card before it counts as a collision. */
const NODE_PAD = 6
/** Half-thickness of the "keep clear" band around a frame's border line. */
const BORDER_BAND = 7

type Obstacle = { rect: Rect; kind: "node" | "border" }

let measureCtx: CanvasRenderingContext2D | null | undefined

function measureLabel(text: string): { w: number; h: number } {
  if (measureCtx === undefined) {
    const canvas = document.createElement("canvas")
    measureCtx = canvas.getContext("2d")
  }
  if (measureCtx) measureCtx.font = LABEL_FONT
  const w = measureCtx ? measureCtx.measureText(text).width : text.length * 6.5
  return { w: Math.ceil(w) + LABEL_MARGIN_X, h: LABEL_HEIGHT }
}

/**
 * Cards block labels outright; frame borders only when the label would sit on
 * top of the border line itself.
 */
function collectObstacles(nodes: AppNode[]): Obstacle[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const obstacles: Obstacle[] = []
  for (const n of nodes) {
    if (n.hidden || n.type === "group") continue
    obstacles.push({ rect: absoluteRect(n, byId), kind: "node" })
  }
  for (const n of nodes) {
    if (n.hidden || n.type !== "group" || !n.parentId) continue
    obstacles.push({ rect: absoluteRect(n, byId), kind: "border" })
  }
  return obstacles
}

function scoreRect(rect: Rect, obstacles: Obstacle[]): number {
  let score = 0
  for (const o of obstacles) {
    if (o.kind === "node") {
      if (rectsIntersect(rect, o.rect, NODE_PAD)) score += 100
    } else {
      const grown = {
        ...o.rect,
        x: o.rect.x - BORDER_BAND,
        y: o.rect.y - BORDER_BAND,
        w: o.rect.w + BORDER_BAND * 2,
        h: o.rect.h + BORDER_BAND * 2,
      }
      const inset = {
        ...o.rect,
        x: o.rect.x + BORDER_BAND,
        y: o.rect.y + BORDER_BAND,
        w: Math.max(0, o.rect.w - BORDER_BAND * 2),
        h: Math.max(0, o.rect.h - BORDER_BAND * 2),
      }
      // Collides when it overlaps the frame's outer band without sitting fully
      // inside the frame or fully clear of it.
      const touchesBand =
        rectsIntersect(rect, grown) && !(rectContains(inset, rect) || !rectsIntersect(rect, o.rect))
      if (touchesBand) score += 45
    }
  }
  return score
}

/**
 * How many *other* edges' strokes pass through the given label rect. Sampled
 * against the rendered SVG geometry so labels never sit on top of a line.
 */
function strokeHits(rect: Rect, paths: SVGPathElement[]): number {
  const samples = [
    { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
    { x: rect.x + 3, y: rect.y + 3 },
    { x: rect.x + rect.w - 3, y: rect.y + 3 },
    { x: rect.x + 3, y: rect.y + rect.h - 3 },
    { x: rect.x + rect.w - 3, y: rect.y + rect.h - 3 },
    { x: rect.x + rect.w / 2, y: rect.y + 2 },
    { x: rect.x + rect.w / 2, y: rect.y + rect.h - 2 },
  ]
  let hits = 0
  for (const p of paths) {
    for (const pt of samples) {
      try {
        if (p.isPointInStroke(new DOMPoint(pt.x, pt.y))) {
          hits += 1
          break
        }
      } catch {
        // Geometry API unavailable or path not measurable; skip this path.
      }
    }
  }
  return hits
}

/**
 * Slide a label along the rendered path until it clears cards and frame
 * borders, and keep it hugging the line — above horizontal runs, beside
 * vertical ones — instead of pinning it to the geometric midpoint where it
 * tends to land on whatever the edge connects to.
 *
 * Returns flow coordinates for the label center, or null when the path is
 * not measurable yet.
 */
export function findAutoLabelSpot(options: {
  /** Invisible wide-stroke path carrying the real edge geometry. */
  pathEl: SVGPathElement
  labelText: string
  nodes: AppNode[]
  /** Other edges' strokes are avoided; this edge's own id is excluded. */
  selfEdgeId: string
}): { x: number; y: number } | null {
  const { pathEl, labelText, nodes, selfEdgeId } = options
  const labelSize = measureLabel(labelText)

  let total = 0
  try {
    total = pathEl.getTotalLength()
  } catch {
    return null
  }
  if (!Number.isFinite(total) || total <= 0) return null

  const obstacles = collectObstacles(nodes)
  const fractions = [0.5, 0.44, 0.56, 0.38, 0.62, 0.32, 0.68, 0.26, 0.74]
  // Hugging distance: half the text height plus breathing room, so the text
  // sits fully clear of the line rather than on top of it.
  const gap = labelSize.h / 2 + 5

  // Every other edge's visible stroke, for arrow-on-arrow avoidance.
  const edgesSvg = pathEl.closest("svg.react-flow__edges")
  const otherPaths = edgesSvg
    ? Array.from(edgesSvg.querySelectorAll<SVGPathElement>("g.react-flow__edge > path[id]")).filter(
        (p) => p.id !== selfEdgeId,
      )
    : []

  let best: { x: number; y: number; score: number } | null = null
  for (const f of fractions) {
    const mid = total * f
    const p = pathEl.getPointAtLength(mid)
    const a = pathEl.getPointAtLength(Math.max(0, mid - 2))
    const b = pathEl.getPointAtLength(Math.min(total, mid + 2))
    let txd = b.x - a.x
    let tyd = b.y - a.y
    const len = Math.hypot(txd, tyd)
    if (len === 0) continue
    txd /= len
    tyd /= len
    const nx = -tyd
    const ny = txd

    // Reference style: horizontal edges carry their label above; vertical
    // ones beside (right preferred). Pick the normal direction that matches,
    // then try its opposite and dead-center as fallbacks.
    const horizontal = Math.abs(txd) >= Math.abs(tyd)
    const sign = horizontal ? (ny > 0 ? -1 : 1) : nx > 0 ? 1 : -1
    const offsets = [gap * sign, -gap * sign, 0]

    for (const o of offsets) {
      const cx = p.x + nx * o
      const cy = p.y + ny * o
      const rect: Rect = {
        x: cx - labelSize.w / 2,
        y: cy - labelSize.h / 2,
        w: labelSize.w,
        h: labelSize.h,
      }
      // Distance penalties keep the winner near the middle of the line;
      // sitting exactly on the line costs extra so side placements win ties.
      const score =
        scoreRect(rect, obstacles) +
        strokeHits(rect, otherPaths) * 25 +
        Math.abs(f - 0.5) * 12 +
        (o === 0 ? 8 : Math.abs(o) / 24)
      if (!best || score < best.score) best = { x: cx, y: cy, score }
    }
  }

  return best ? { x: best.x, y: best.y } : null
}
