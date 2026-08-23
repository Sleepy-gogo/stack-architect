import { Handle, Position, type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { BrandIcon } from "./BrandIcon"
import { NodeActions } from "./NodeActions"
import { categoryMap } from "@/lib/catalog"
import { resolveSwatch } from "@/lib/swatches"
import type { TechNodeData } from "@/lib/types"

const HANDLE_POSITIONS = [
  { id: "left", position: Position.Left },
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
] as const

export function TechNode({ id, data, selected }: NodeProps) {
  const d = data as TechNodeData
  const cat = categoryMap[d.category as keyof typeof categoryMap]
  const accent = resolveSwatch(d.colorOverride) ?? cat?.color ?? "#64748b"
  const isDark = d.dark === true
  const hasIconPlate = isDark && d.iconPlate === true

  return (
    <div className="group/node relative flex w-[148px] flex-col items-center gap-2.5">
      <NodeActions nodeId={id} visible={selected === true} />

      <div
        className={cn(
          "node-card relative flex size-[92px] items-center justify-center rounded-[18px] border transition-[box-shadow,transform] duration-150",
          "group-hover/node:-translate-y-0.5",
          isDark
            ? "border-zinc-700 bg-zinc-900 text-zinc-100 shadow-[0_2px_4px_-1px_rgb(15_23_42/0.18),0_8px_18px_-8px_rgb(15_23_42/0.35)]"
            : "border-slate-200 bg-white text-slate-900 shadow-[0_1px_2px_0_rgb(15_23_42/0.06),0_6px_16px_-8px_rgb(15_23_42/0.22)] dark:border-slate-700 dark:bg-slate-100",
        )}
      >
        {hasIconPlate ? (
          <span className="dark-node-icon-plate" aria-hidden="true">
            <BrandIcon slug={d.slug} size={44} />
          </span>
        ) : (
          <BrandIcon slug={d.slug} size={44} />
        )}

        <span
          aria-hidden="true"
          className="absolute inset-x-5 -bottom-px h-px rounded-full opacity-70"
          style={{ backgroundColor: accent }}
        />

        {HANDLE_POSITIONS.map((h) => (
          <Handle
            key={h.id}
            id={h.id}
            type="source"
            position={h.position}
            aria-label={`Connect from the ${h.id} of ${d.name}`}
          />
        ))}
        <Handle
          id="center"
          type="source"
          position={Position.Bottom}
          className="surface-handle"
          style={{ width: "100%", height: "100%", inset: 0 }}
          isConnectableStart={false}
          aria-label={`Connect to ${d.name}`}
        />
      </div>

      <div className="flex w-full flex-col items-center gap-0.5 text-center">
        <span
          className="halo-text relative max-w-full text-[15px] leading-tight font-semibold tracking-[-0.012em] text-foreground"
          data-label={d.name}
        >
          <span>{d.name}</span>
        </span>
        {d.subtitle ? (
          <span
            className="halo-text relative max-w-full font-mono text-[11px] leading-tight tracking-[0.01em] text-muted-foreground"
            data-label={d.subtitle}
          >
            <span>{d.subtitle}</span>
          </span>
        ) : null}
      </div>
    </div>
  )
}
