import { useMemo, useState } from "react"
import { useReactFlow } from "@xyflow/react"
import {
  ChevronDownIcon,
  EyeIcon,
  EyeOffIcon,
  FrameIcon,
  LockIcon,
  LockOpenIcon,
  TypeIcon,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { nodeLabel } from "@/lib/node-labels"
import { cn } from "@/lib/utils"
import { BrandIcon } from "./BrandIcon"
import { IconButton } from "@/components/shared/IconButton"
import type { AppNode, TechNodeData } from "@/lib/types"

function truncateLabel(label: string): string {
  return label.length > 26 ? `${label.slice(0, 26)}…` : label
}

export function LayersPanel() {
  const [open, setOpen] = useState(true)
  const nodes = useStore((s) => s.nodes)
  const focusNode = useStore((s) => s.focusNode)
  const setNodeFlag = useStore((s) => s.setNodeFlag)
  const { fitView } = useReactFlow()

  // Frames first, then their children indented, then everything unparented.
  const rows = useMemo(() => {
    const result: { node: AppNode; depth: number }[] = []
    const byParent = new Map<string | undefined, AppNode[]>()
    for (const n of nodes) {
      const list = byParent.get(n.parentId) ?? []
      list.push(n)
      byParent.set(n.parentId, list)
    }
    const walk = (parentId: string | undefined, depth: number) => {
      const children = byParent.get(parentId) ?? []
      const sorted = [...children].sort((a, b) => {
        if (a.type === "group" && b.type !== "group") return -1
        if (b.type === "group" && a.type !== "group") return 1
        return 0
      })
      for (const node of sorted) {
        result.push({ node, depth })
        walk(node.id, depth + 1)
      }
    }
    walk(undefined, 0)
    return result
  }, [nodes])

  return (
    <div className="pointer-events-auto w-60 overflow-hidden rounded-2xl border border-border bg-card/95 shadow-[0_2px_6px_-2px_rgb(15_23_42/0.12),0_12px_28px_-16px_rgb(15_23_42/0.35)] backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="layers-list"
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Layers
          <span className="ml-1.5 font-mono tracking-normal tabular-nums">{nodes.length}</span>
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 text-muted-foreground transition-transform duration-200",
            !open && "-rotate-90",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <ul id="layers-list" className="max-h-44 overflow-y-auto border-t border-border p-1">
          {rows.length === 0 ? (
            <li className="px-2 py-3 text-center text-xs text-muted-foreground">
              Nothing on the canvas yet
            </li>
          ) : (
            rows.map(({ node, depth }) => {
              const hidden = node.hidden === true
              const locked = node.draggable === false
              const label = truncateLabel(nodeLabel(node))
              return (
                <li key={node.id}>
                  <div
                    className={cn(
                      "group/row flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-muted/70",
                      node.selected && "bg-primary/10",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        focusNode(node.id)
                        fitView({ nodes: [{ id: node.id }], padding: 0.55, duration: 250, maxZoom: 1.4 })
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pl-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      style={{ paddingLeft: `${8 + depth * 12}px` }}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                        {node.type === "group" ? (
                          <FrameIcon className="size-3.5" aria-hidden="true" />
                        ) : node.type === "text" ? (
                          <TypeIcon className="size-3.5" aria-hidden="true" />
                        ) : (
                          <BrandIcon slug={(node.data as TechNodeData).slug} size={14} />
                        )}
                      </span>
                      <span
                        className={cn(
                          "truncate text-xs",
                          hidden ? "text-muted-foreground/60 line-through" : "text-foreground",
                        )}
                      >
                        {label}
                      </span>
                    </button>

                    <IconButton
                      label={hidden ? `Show ${label}` : `Hide ${label}`}
                      pressed={hidden}
                      onClick={() => setNodeFlag(node.id, "hidden", !hidden)}
                      className="size-6 rounded-md text-muted-foreground/50 group-hover/row:text-muted-foreground focus-visible:text-muted-foreground"
                    >
                      {hidden ? <EyeOffIcon className="size-3.5" /> : <EyeIcon className="size-3.5" />}
                    </IconButton>
                    <IconButton
                      label={locked ? `Unlock ${label}` : `Lock ${label}`}
                      pressed={locked}
                      onClick={() => setNodeFlag(node.id, "locked", !locked)}
                      className="size-6 rounded-md text-muted-foreground/50 group-hover/row:text-muted-foreground focus-visible:text-muted-foreground"
                    >
                      {locked ? <LockIcon className="size-3.5" /> : <LockOpenIcon className="size-3.5" />}
                    </IconButton>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}
