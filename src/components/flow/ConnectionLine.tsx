import { Position, getSmoothStepPath, type ConnectionLineComponentProps } from "@xyflow/react"
import { EDGE_SOLID } from "@/lib/types"

export function ConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
}: ConnectionLineComponentProps) {
  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
    sourcePosition: fromPosition ?? Position.Right,
    targetPosition: toPosition ?? Position.Left,
    borderRadius: 10,
  })

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={EDGE_SOLID}
        strokeWidth={2.25}
        strokeDasharray="6 6"
        style={{ pointerEvents: "none" }}
      />
      <circle cx={toX} cy={toY} r={4} fill={EDGE_SOLID} />
    </g>
  )
}
