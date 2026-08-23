import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { resolveSwatch } from "@/lib/swatches"
import { BrandIcon } from "./BrandIcon"
import type { GroupNodeData } from "@/lib/types"

const HANDLE_POSITIONS = [
  { id: "left", position: Position.Left },
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
] as const

export function GroupNode({ data, selected }: NodeProps) {
  const d = data as GroupNodeData
  const color = resolveSwatch(d.color) || "#3b82f6"

  return (
    <>
      <NodeResizer
        isVisible={selected === true}
        minWidth={220}
        minHeight={180}
        lineClassName="!border-primary/60"
        handleClassName="!size-2 !rounded-[3px] !border-2 !border-primary !bg-background"
      />

      <div
        className={cn(
          "size-full rounded-2xl border-[1.5px] transition-shadow",
          selected && "shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_28%,transparent)]",
        )}
        style={{
          borderColor: color,
          borderStyle: d.dashed ? "dashed" : "solid",
          backgroundColor: `color-mix(in oklch, ${color} 5%, transparent)`,
        }}
      />

      <div
        className="absolute -top-2.5 left-7 flex max-w-[calc(100%-3.5rem)] items-center gap-1.5 bg-[var(--canvas)] px-2"
        style={{ color }}
      >
        {d.icon ? (
          <span className="flex size-4 shrink-0 items-center justify-center">
            <BrandIcon slug={d.icon} size={14} />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="truncate font-mono text-[11px] font-semibold tracking-[0.14em] uppercase">
          {d.label}
        </span>
      </div>

      {HANDLE_POSITIONS.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={h.position}
          aria-label={`Connect from the ${h.id} of ${d.label}`}
        />
      ))}

      <Handle
        id="center"
        type="source"
        position={Position.Bottom}
        className="surface-handle"
        style={{ width: "100%", height: "100%", inset: 0 }}
        isConnectableStart={false}
        aria-label={`Connect to ${d.label}`}
      />
    </>
  )
}
