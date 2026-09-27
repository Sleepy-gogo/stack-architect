import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useReactFlow, useStore as useFlowStore } from "@xyflow/react"
import { useStore } from "@/lib/store"
import { addRouteBend, moveRouteSegment, routeSegments } from "@/lib/editable-route"
import { simplifyRoute, type RoutePoint } from "@/lib/orthogonal-route"

type Drag = {
  index: number
  axis: "x" | "y"
  start: RoutePoint
  points: RoutePoint[]
  delta: number
}

export function EdgeRouteControls({ id, points, onPreview }: {
  id: string
  points: RoutePoint[]
  onPreview: (points: RoutePoint[] | null) => void
}) {
  const { screenToFlowPosition, getZoom } = useReactFlow()
  const zoom = useFlowStore((s) => s.transform[2])
  const updateEdge = useStore((s) => s.updateEdge)
  const dragRef = useRef<Drag | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const handles = useRef(new Map<number, HTMLButtonElement>())
  const pendingFocus = useRef<number | null>(null)
  const segments = routeSegments(drag?.points ?? points)

  const cancel = useCallback(() => {
    dragRef.current = null
    setDrag(null)
    onPreview(null)
  }, [onPreview])

  useLayoutEffect(() => {
    if (pendingFocus.current === null) return
    handles.current.get(pendingFocus.current)?.focus({ preventScroll: true })
    pendingFocus.current = null
  }, [points])

  useEffect(() => {
    const cancelOnBlur = () => cancel()
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dragRef.current) {
        event.preventDefault()
        event.stopPropagation()
        cancel()
      }
    }
    window.addEventListener("blur", cancelOnBlur)
    window.addEventListener("keydown", cancelOnEscape, true)
    return () => {
      window.removeEventListener("blur", cancelOnBlur)
      window.removeEventListener("keydown", cancelOnEscape, true)
    }
  }, [cancel])

  const commit = (next: RoutePoint[]) => updateEdge(id, { routePoints: simplifyRoute(next) })
  const finish = () => {
    const active = dragRef.current
    if (!active) return
    if (active.delta !== 0) commit(moveRouteSegment(active.points, active.index, active.delta))
    cancel()
  }

  return <>
    {segments.map((segment) => {
      const active = drag?.index === segment.index
      const atEndpoint = segment.index === 0 || segment.index === segments.length - 1
      if (!active && atEndpoint && segment.length * zoom < 32) return null
      const x = segment.x + (active && segment.axis === "x" ? drag.delta : 0)
      const y = segment.y + (active && segment.axis === "y" ? drag.delta : 0)
      return <button
        key={segment.index}
        type="button"
        data-export-ignore="true"
        ref={(element) => {
          if (element) handles.current.set(segment.index, element)
          else handles.current.delete(segment.index)
        }}
        aria-label={`Move segment ${segment.index + 1} ${segment.axis === "x" ? "left or right" : "up or down"}`}
        aria-describedby={`route-help-${id}`}
        title="Drag to move. Double-click to add bends."
        className="edge-route-handle group nodrag nopan nowheel pointer-events-auto absolute flex size-7 touch-none items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${1 / zoom})`,
          cursor: segment.axis === "x" ? "ew-resize" : "ns-resize",
          visibility: drag && !active ? "hidden" : undefined }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => { e.stopPropagation(); commit(addRouteBend(points, segment.index)) }}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          const next: Drag = { index: segment.index, axis: segment.axis,
            start: screenToFlowPosition({ x: e.clientX, y: e.clientY }), points, delta: 0 }
          dragRef.current = next
          setDrag(next)
        }}
        onPointerMove={(e) => {
          const active = dragRef.current
          if (!active) return
          e.stopPropagation()
          const cursor = screenToFlowPosition({ x: e.clientX, y: e.clientY })
          let delta = cursor[active.axis] - active.start[active.axis]
          if (Math.abs(delta) * getZoom() < 3) delta = 0
          const { snapToGrid, gridSize } = useStore.getState()
          if (delta && snapToGrid && !e.altKey) {
            const origin = active.points[active.index][active.axis]
            delta = Math.round((origin + delta) / gridSize) * gridSize - origin
          }
          const next = { ...active, delta }
          dragRef.current = next
          setDrag(next)
          onPreview(delta ? moveRouteSegment(active.points, active.index, delta) : null)
        }}
        onPointerUp={finish}
        onPointerCancel={cancel}
        onLostPointerCapture={cancel}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.stopPropagation(); cancel(); return }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            e.stopPropagation()
            pendingFocus.current = segment.index + 2
            commit(addRouteBend(points, segment.index))
            return
          }
          if (!e.key.startsWith("Arrow")) return
          e.preventDefault()
          e.stopPropagation()
          const direction = segment.axis === "x"
            ? (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0)
            : (e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0)
          if (direction) {
            pendingFocus.current = segment.index === 0 ? 2 : segment.index
            commit(moveRouteSegment(points, segment.index, direction * (e.shiftKey ? 10 : 1)))
          }
        }}
      >
        <span
          className="size-2.5 rounded-full border-2 bg-[var(--canvas)] shadow-sm group-hover:bg-primary group-focus-visible:bg-primary"
          style={{ borderColor: "var(--primary)" }}
        />
      </button>
    })}
    <span id={`route-help-${id}`} className="sr-only" data-export-ignore="true">
      Drag or use arrow keys to move this segment. Shift moves by 10. Alt bypasses grid snapping.
      Double-click or press Enter to add bends. Escape cancels a drag.
    </span>
  </>
}
