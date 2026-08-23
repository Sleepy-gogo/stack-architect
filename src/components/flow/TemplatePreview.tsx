import { useId } from "react"
import { categoryMap } from "@/lib/catalog"
import { absoluteRect, anchorRect, type Rect } from "@/lib/geometry"
import {
  EDGE_DASHED,
  EDGE_SOLID,
  TECH_CARD_SIZE,
  type GraphDocument,
  type GroupNodeData,
  type TechNodeData,
} from "@/lib/types"
import { BrandIcon } from "./BrandIcon"

const MIN_CARD = 9
const MAX_CARD = 14
const ICON_MIN_CARD = 10

type Pt = { x: number; y: number }

function handlePoint(r: Rect, handle: string | undefined): Pt {
  switch (handle) {
    case "left":
      return { x: r.x, y: r.y + r.h / 2 }
    case "right":
      return { x: r.x + r.w, y: r.y + r.h / 2 }
    case "top":
      return { x: r.x + r.w / 2, y: r.y }
    case "bottom":
    default:
      return { x: r.x + r.w / 2, y: r.y + r.h }
  }
}

type SceneFrame = Rect & { color: string; dashed: boolean }

type SceneEdge = {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  dashed: boolean
}

type SceneCard = {
  cx: number
  cy: number
  s: number
  accent: string
  dark: boolean
  iconPlate: boolean
  slug: string
}

type Scene = { frames: SceneFrame[]; edges: SceneEdge[]; cards: SceneCard[] }

function buildScene(doc: GraphDocument, width: number, height: number): Scene {
  const empty: Scene = { frames: [], edges: [], cards: [] }
  const byId = new Map(doc.nodes.map((n) => [n.id, n]))
  const rects = new Map<string, Rect>()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const visualNodes = doc.nodes.filter((n) => !n.hidden && n.type !== "text")
  if (visualNodes.length === 0) return empty

  for (const n of visualNodes) {
    const r = n.type === "tech" ? anchorRect(n, byId) : absoluteRect(n, byId)
    rects.set(n.id, r)
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
  }

  const pad = 5
  const bw = Math.max(maxX - minX, 1)
  const bh = Math.max(maxY - minY, 1)
  const scale = Math.min((width - pad * 2) / bw, (height - pad * 2) / bh)
  const ox = (width - bw * scale) / 2 - minX * scale
  const oy = (height - bh * scale) / 2 - minY * scale

  const frames: SceneFrame[] = []
  const cards: SceneCard[] = []
  for (const n of visualNodes) {
    const r = rects.get(n.id)!
    if (n.type === "group") {
      const d = n.data as GroupNodeData
      frames.push({
        x: r.x * scale + ox,
        y: r.y * scale + oy,
        w: r.w * scale,
        h: r.h * scale,
        color: d.color ?? "#64748b",
        dashed: d.dashed === true,
      })
      continue
    }
    if (n.type !== "tech") continue
    const d = n.data as TechNodeData
    cards.push({
      cx: (r.x + r.w / 2) * scale + ox,
      cy: (r.y + r.h / 2) * scale + oy,
      s: Math.min(MAX_CARD, Math.max(MIN_CARD, TECH_CARD_SIZE * scale)),
      accent:
        d.colorOverride ??
        categoryMap[d.category as keyof typeof categoryMap]?.color ??
        "#64748b",
      dark: d.dark === true,
      iconPlate: d.dark === true && d.iconPlate === true,
      slug: d.slug,
    })
  }

  const edges: SceneEdge[] = []
  for (const e of doc.edges) {
    const source = rects.get(e.source)
    const target = rects.get(e.target)
    if (!source || !target) continue
    const dashed = e.data?.style === "dashed"
    const a = handlePoint(source, e.sourceHandle ?? undefined)
    const b = handlePoint(target, e.targetHandle ?? undefined)
    edges.push({
      x1: a.x * scale + ox,
      y1: a.y * scale + oy,
      x2: b.x * scale + ox,
      y2: b.y * scale + oy,
      color: e.data?.colorOverride ?? (dashed ? EDGE_DASHED : EDGE_SOLID),
      dashed,
    })
  }

  return { frames, edges, cards }
}

export function TemplatePreview({
  doc,
  className,
}: {
  doc: GraphDocument
  className?: string
}) {
  const width = 74
  const height = 52
  const scene = buildScene(doc, width, height)
  const filterId = `${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-card`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="0.6" stdDeviation="0.6" floodColor="#0f172a" floodOpacity="0.3" />
        </filter>
      </defs>

      {scene.frames.map((f, i) => (
        <rect
          key={i}
          x={f.x}
          y={f.y}
          width={Math.max(f.w, 2)}
          height={Math.max(f.h, 2)}
          rx={3}
          fill={`color-mix(in oklch, ${f.color} 6%, transparent)`}
          stroke={`color-mix(in oklch, ${f.color} 48%, transparent)`}
          strokeWidth={1}
          strokeDasharray={f.dashed ? "2.5 2" : undefined}
        />
      ))}

      {scene.edges.map((e, i) => (
        <line
          key={i}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke={e.color}
          strokeWidth={1}
          strokeLinecap="round"
          opacity={e.dashed ? 0.75 : 0.45}
          strokeDasharray={e.dashed ? "3 2" : undefined}
        />
      ))}

      <g filter={`url(#${filterId})`}>
        {scene.cards.map((c, i) => (
          <g key={i}>
            <rect
              x={c.cx - c.s / 2}
              y={c.cy - c.s / 2}
              width={c.s}
              height={c.s}
              rx={c.s * 0.24}
              fill={c.dark ? "#18181b" : "#ffffff"}
              stroke={c.dark ? "#52525b" : "#dbe3ee"}
              strokeWidth={1}
            />
            {c.iconPlate ? (
              <rect
                x={c.cx - c.s * 0.37}
                y={c.cy - c.s * 0.37}
                width={c.s * 0.74}
                height={c.s * 0.74}
                rx={c.s * 0.16}
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth={0.6}
              />
            ) : null}
            {c.s >= ICON_MIN_CARD ? (
              <g
                transform={`translate(${(c.cx - c.s * 0.29).toFixed(2)} ${(c.cy - c.s * 0.29).toFixed(2)})`}
                style={{
                  color: c.accent,
                  filter: c.iconPlate ? "drop-shadow(0 0 0.7px rgb(15 23 42 / 0.35))" : undefined,
                }}
              >
                <BrandIcon slug={c.slug} size={c.s * 0.58} />
              </g>
            ) : (
              <circle cx={c.cx} cy={c.cy} r={Math.max(1.6, c.s * 0.22)} fill={c.accent} />
            )}
          </g>
        ))}
      </g>
    </svg>
  )
}
