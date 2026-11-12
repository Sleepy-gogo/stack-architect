import { type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { legendColor, legendSize } from "@/lib/legend"
import { resolveSwatch } from "@/lib/swatches"
import type { LegendNodeData } from "@/lib/types"

/** Explains what each line color and style means. Not connectable. */
export function LegendNode({ data, selected }: NodeProps) {
  const d = data as LegendNodeData
  const { w, h } = legendSize(d)

  return (
    <div
      className={cn(
        "flex flex-col justify-center rounded-xl border border-border bg-card/90 px-3.5 shadow-[0_1px_2px_0_rgb(15_23_42/0.05)] backdrop-blur-[2px] transition-shadow",
        selected && "shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_28%,transparent)]",
      )}
      style={{ width: w, height: h }}
    >
      {d.title ? (
        <p className="mb-1 truncate font-mono text-[10.5px] leading-[22px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {d.title}
        </p>
      ) : null}
      {d.items.length === 0 ? (
        <p className="text-xs leading-[22px] text-muted-foreground italic">No entries</p>
      ) : (
        <ul className="flex flex-col">
          {d.items.map((item, index) => (
            <li key={index} className="flex h-[22px] items-center gap-2.5">
              <svg width="28" height="10" aria-hidden="true" className="shrink-0">
                <line
                  x1="1"
                  y1="5"
                  x2="27"
                  y2="5"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeDasharray={item.style === "dashed" ? "5 4" : undefined}
                  style={{ stroke: resolveSwatch(legendColor(item)) }}
                />
              </svg>
              <span className="truncate font-mono text-[11.5px] text-foreground">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
