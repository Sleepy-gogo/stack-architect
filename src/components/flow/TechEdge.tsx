import { useLayoutEffect, useRef, useState } from "react"
import {
  EdgeLabelRenderer,
  Position,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react"
import { useStore } from "@/lib/store"
import { resolveSwatch } from "@/lib/swatches"
import { EDGE_DASHED, EDGE_SOLID, type TechEdgeData } from "@/lib/types"
import { anchorRect, findConnectableAt } from "@/lib/geometry"
import {
  autoSide,
  projectToPerimeter,
  readNorm,
  resolveAnchor,
  sideFromNorm,
  snapToSide,
} from "@/lib/edge-anchors"
import { findAutoLabelSpot } from "@/lib/edge-labels"

const SIBLING_SPREAD = 18

type End = "source" | "target"
type NormPoint = { x: number; y: number }

export function TechEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const d = (data ?? {}) as TechEdgeData
  const isDashed = d.style === "dashed"
  const color = resolveSwatch(d.colorOverride) ?? (isDashed ? EDGE_DASHED : EDGE_SOLID)
  const selectEdge = useStore((s) => s.selectEdge)
  const updateEdge = useStore((s) => s.updateEdge)
  const setEdgeRoute = useStore((s) => s.setEdgeRoute)
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const { screenToFlowPosition } = useReactFlow()

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const srcNode = byId.get(source)
  const tgtNode = byId.get(target)
  const srcRect = srcNode ? anchorRect(srcNode, byId) : null
  const tgtRect = tgtNode ? anchorRect(tgtNode, byId) : null

  /* ---------- Endpoint dragging ---------- */

  const [hovered, setHovered] = useState(false)
  const [preview, setPreview] = useState<{ source: NormPoint | null; target: NormPoint | null } | null>(
    null,
  )
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<End | null>(null)
  const dragRef = useRef<{ end: End; moved: boolean } | null>(null)
  const previewRef = useRef(preview)
  const overRef = useRef(dragOverId)
  const cursorRef = useRef<{ x: number; y: number } | null>(null)

  const effSource = preview ? preview.source : readNorm(d.sourcePoint)
  const effTarget = preview ? preview.target : readNorm(d.targetPoint)

  // While dragging an endpoint over another object, preview against that
  // object's surface instead of the endpoint's own node.
  const overNode = dragOverId ? byId.get(dragOverId) : undefined
  const effSrcRect =
    activeDrag === "source" && overNode ? anchorRect(overNode, byId) : srcRect
  const effTgtRect =
    activeDrag === "target" && overNode ? anchorRect(overNode, byId) : tgtRect

  // Each end attaches to one of the four canonical points of its card: either
  // a spot the user placed it at, or the geometrically best side, re-evaluated
  // as the nodes move.
  let sx = sourceX
  let sy = sourceY
  let sp = sourcePosition ?? Position.Right
  let tx = targetX
  let ty = targetY
  let tp = targetPosition ?? Position.Left

  if (effSrcRect && effTgtRect && source !== target) {
    const sc = { x: effSrcRect.x + effSrcRect.w / 2, y: effSrcRect.y + effSrcRect.h / 2 }
    const tc = { x: effTgtRect.x + effTgtRect.w / 2, y: effTgtRect.y + effTgtRect.h / 2 }
    const sa = resolveAnchor(effSrcRect, tc, effSource)
    const ta = resolveAnchor(effTgtRect, sc, effTarget)
    sx = sa.x
    sy = sa.y
    sp = sa.position
    tx = ta.x
    ty = ta.y
    tp = ta.position

    // Fully-automatic siblings joining the same two nodes fan out sideways so
    // their strokes never stack on one shared centre line.
    if (!effSource && !effTarget) {
      const siblings = edges.filter(
        (e) =>
          (e.source === source && e.target === target) ||
          (e.source === target && e.target === source),
      )
      const rank = siblings.findIndex((e) => e.id === id)
      const spread = (rank - (siblings.length - 1) / 2) * SIBLING_SPREAD
      if (spread !== 0) {
        const len = Math.hypot(tc.x - sc.x, tc.y - sc.y) || 1
        const nx = -(tc.y - sc.y) / len
        const ny = (tc.x - sc.x) / len
        sx += nx * spread
        sy += ny * spread
        tx += nx * spread
        ty += ny * spread
      }
    }
  }

  // Right angles read as a system diagram; bezier curves read as a mind map.
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    sourcePosition: sp,
    targetPosition: tp,
    borderRadius: 10,
  })

  /* ---------- Label auto-placement ---------- */

  const markerId = `arrow-${id}`
  const hitRef = useRef<SVGPathElement>(null)
  const [autoPos, setAutoPos] = useState<{ x: number; y: number } | null>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const labelDragRef = useRef<{
    startX: number
    startY: number
    baseX: number
    baseY: number
    moved: boolean
  } | null>(null)
  const suppressClickRef = useRef(false)

  const customPos =
    typeof d.labelX === "number" && typeof d.labelY === "number"
      ? { x: d.labelX, y: d.labelY }
      : null
  const hasCustomLabel = customPos !== null

  useLayoutEffect(() => {
    if (!d.label || hasCustomLabel) return
    const el = hitRef.current
    if (!el) return
    const spot = findAutoLabelSpot({
      pathEl: el,
      labelText: d.label,
      nodes: useStore.getState().nodes,
      selfEdgeId: id,
    })
    if (spot) setAutoPos(spot)
  }, [path, d.label, hasCustomLabel, d.labelX, d.labelY, nodes, id])

  /* ---------- Label dragging ---------- */

  const beginLabelDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const base = customPos ?? autoPos ?? { x: labelX, y: labelY }
    labelDragRef.current = {
      startX: flow.x,
      startY: flow.y,
      baseX: base.x,
      baseY: base.y,
      moved: false,
    }
  }

  const moveLabelDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = labelDragRef.current
    if (!st) return
    e.stopPropagation()
    const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    if (Math.hypot(flow.x - st.startX, flow.y - st.startY) > 1.5) st.moved = true
    setDragPos({ x: st.baseX + flow.x - st.startX, y: st.baseY + flow.y - st.startY })
  }

  /** One history snapshot per gesture, on drop. */
  const endLabelDrag = () => {
    const st = labelDragRef.current
    if (!st) return
    labelDragRef.current = null
    suppressClickRef.current = st.moved
    setDragPos((pos) => {
      if (st.moved && pos) updateEdge(id, { labelX: pos.x, labelY: pos.y })
      return null
    })
  }

  const shownPos = dragPos ?? customPos ?? autoPos ?? { x: labelX, y: labelY }

  /* ---------- Endpoint drag handlers ---------- */

  const beginEndpointDrag = (end: End) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    selectEdge(id)
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { end, moved: false }
    setActiveDrag(end)
    cursorRef.current = screenToFlowPosition({ x: e.clientX, y: e.clientY })
  }

  const moveEndpointDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragRef.current
    if (!st) return
    e.stopPropagation()
    const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    if (
      cursorRef.current &&
      Math.hypot(flow.x - cursorRef.current.x, flow.y - cursorRef.current.y) > 1.5
    ) {
      st.moved = true
    }
    cursorRef.current = flow

    // Dropping onto a different object retargets the endpoint; otherwise the
    // point slides around the object's own surface.
    const selfId = st.end === "source" ? source : target
    const over = findConnectableAt(flow.x, flow.y, nodes, byId)
    const other = over && over.id !== selfId ? over : null
    const rect = other
      ? anchorRect(other, byId)
      : st.end === "source"
        ? srcRect
        : tgtRect
    if (!rect) return

    const snapped = snapToSide(rect, flow.x, flow.y)
    const norm = snapped ?? projectToPerimeter(rect, flow.x, flow.y)

    setDragOverId(other?.id ?? null)
    overRef.current = other?.id ?? null
    setPreview((prev) => {
      const base = prev ?? { source: readNorm(d.sourcePoint), target: readNorm(d.targetPoint) }
      return st.end === "source" ? { ...base, source: norm } : { ...base, target: norm }
    })
    previewRef.current = {
      source: st.end === "source" ? norm : (previewRef.current?.source ?? readNorm(d.sourcePoint)),
      target: st.end === "target" ? norm : (previewRef.current?.target ?? readNorm(d.targetPoint)),
    }
  }

  const finishEndpointDrag = () => {
    const st = dragRef.current
    if (!st) return
    dragRef.current = null
    setActiveDrag(null)
    const value = previewRef.current?.[st.end] ?? null
    const droppedOnId = overRef.current
    setDragOverId(null)
    overRef.current = null
    setPreview(null)
    previewRef.current = null
    cursorRef.current = null
    if (!st.moved || !value) return

    // Retarget: the endpoint was released over a different object.
    const selfId = st.end === "source" ? source : target
    if (droppedOnId && droppedOnId !== selfId) {
      setEdgeRoute(
        id,
        st.end === "source" ? { source: droppedOnId } : { target: droppedOnId },
        st.end === "source" ? { sourcePoint: undefined } : { targetPoint: undefined },
      )
      return
    }

    // Dropping back onto the automatic side unpins, so the endpoint keeps
    // following the nodes; anything else stores the exact spot.
    const rect = st.end === "source" ? srcRect : tgtRect
    const otherRect = st.end === "source" ? tgtRect : srcRect
    const side = sideFromNorm(value)
    const isAutoSpot =
      side !== null &&
      rect != null &&
      otherRect != null &&
      side ===
        autoSide(rect, {
          x: otherRect.x + otherRect.w / 2,
          y: otherRect.y + otherRect.h / 2,
        })

    updateEdge(
      id,
      st.end === "source"
        ? { sourcePoint: isAutoSpot ? undefined : value }
        : { targetPoint: isAutoSpot ? undefined : value },
    )
  }

  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8.75"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0.5 L 9.5 5 L 0 9.5 z" style={{ fill: color }} />
        </marker>
      </defs>

      <path
        ref={hitRef}
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        strokeLinecap="round"
        style={{ pointerEvents: "stroke" }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => {
          if (!dragRef.current) setHovered(false)
        }}
      />
      <path
        id={id}
        d={path}
        fill="none"
        strokeWidth={selected ? 3 : 2.25}
        strokeLinecap="round"
        strokeDasharray={isDashed ? "7 6" : undefined}
        markerEnd={`url(#${markerId})`}
        style={{ pointerEvents: "none", stroke: color }}
      />

      {d.label || selected || hovered ? (
        <EdgeLabelRenderer>
          {d.label ? (
            <div
              role="button"
              tabIndex={-1}
              aria-label={`Connection label ${d.label}. Drag to reposition, double-click to reset`}
              data-label={d.label}
              onClick={(e) => {
                e.stopPropagation()
                if (suppressClickRef.current) {
                  suppressClickRef.current = false
                  return
                }
                selectEdge(id)
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                if (customPos) updateEdge(id, { labelX: undefined, labelY: undefined })
              }}
              onPointerDown={beginLabelDrag}
              onPointerMove={moveLabelDrag}
              onPointerUp={endLabelDrag}
              onLostPointerCapture={endLabelDrag}
              onPointerEnter={() => setHovered(true)}
              className={`edge-label nodrag nopan nowheel pointer-events-auto absolute touch-none select-none ${
                dragPos ? "cursor-grabbing" : "cursor-grab"
              } font-mono text-[11.5px] leading-none font-semibold tracking-[0.03em] transition-opacity hover:opacity-90`}
              style={{
                transform: `translate(-50%, -50%) translate(${shownPos.x}px, ${shownPos.y}px)`,
                color,
              }}
            >
              <span>{d.label}</span>
            </div>
          ) : null}

          {selected || hovered
            ? (["source", "target"] as const).map((end) => {
                const pt = end === "source" ? { x: sx, y: sy } : { x: tx, y: ty }
                return (
                  <div
                    key={end}
                    role="button"
                    tabIndex={-1}
                    aria-label={`${end === "source" ? "Start" : "End"} of the connection. Drag to move where it attaches; double-click to reset.`}
                    onPointerDown={beginEndpointDrag(end)}
                    onPointerMove={moveEndpointDrag}
                    onPointerUp={finishEndpointDrag}
                    onLostPointerCapture={finishEndpointDrag}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      if (end === "source") updateEdge(id, { sourcePoint: undefined })
                      else updateEdge(id, { targetPoint: undefined })
                    }}
                    className={`endpoint-dot nodrag nopan nowheel pointer-events-auto absolute size-3 touch-none rounded-full border-2 after:absolute after:-inset-2 after:rounded-full after:content-[''] ${
                      activeDrag === end ? "cursor-grabbing" : "cursor-grab"
                    }`}
                    style={{
                      transform: `translate(-50%, -50%) translate(${pt.x}px, ${pt.y}px)`,
                      borderColor: color,
                      backgroundColor: "var(--canvas)",
                      boxShadow: "0 1px 3px rgb(15 23 42 / 0.3)",
                    }}
                  />
                )
              })
            : null}
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
