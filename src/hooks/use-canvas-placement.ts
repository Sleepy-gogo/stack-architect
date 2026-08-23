import { useRef } from "react"
import { useReactFlow } from "@xyflow/react"
import { NODE_HEIGHT, NODE_WIDTH } from "@/lib/types"

/**
 * Drops new objects near the middle of whatever the user is currently looking at,
 * fanning consecutive additions out so they never stack on top of each other.
 */
export function useCanvasPlacement() {
  const { screenToFlowPosition } = useReactFlow()
  const stepRef = useRef(0)

  return (width = NODE_WIDTH, height = NODE_HEIGHT) => {
    const pane = document.querySelector<HTMLElement>(".react-flow__pane")
    const rect = pane?.getBoundingClientRect()
    const step = stepRef.current++
    const offset = (step % 6) * 28

    if (!rect) return { x: offset, y: offset }

    const center = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })

    return {
      x: Math.round(center.x - width / 2 + offset),
      y: Math.round(center.y - height / 2 + offset),
    }
  }
}
