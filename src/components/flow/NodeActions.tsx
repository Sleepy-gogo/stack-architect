import { NodeToolbar, Position } from "@xyflow/react"
import { CopyIcon, MoonIcon, SunIcon, Trash2Icon } from "lucide-react"
import { useStore } from "@/lib/store"
import type { TechNodeData } from "@/lib/types"
import { IconButton } from "@/components/shared/IconButton"

export function NodeActions({ nodeId, visible }: { nodeId: string; visible: boolean }) {
  const duplicateNode = useStore((s) => s.duplicateNode)
  const deleteNode = useStore((s) => s.deleteNode)
  const updateNodeData = useStore((s) => s.updateNodeData)
  const isDark = useStore((s) => {
    const node = s.nodes.find((n) => n.id === nodeId)
    return (node?.data as TechNodeData | undefined)?.dark === true
  })

  return (
    <NodeToolbar isVisible={visible} position={Position.Top} offset={14} align="center">
      <div
        role="toolbar"
        aria-label="Node actions"
        className="flex items-center gap-0.5 rounded-xl border border-border bg-popover p-1 shadow-[0_6px_20px_-8px_rgb(15_23_42/0.4)]"
      >
        <IconButton
          label="Duplicate"
          onClick={() => duplicateNode(nodeId)}
          className="size-7"
        >
          <CopyIcon className="size-3.5" />
        </IconButton>
        <IconButton
          label={isDark ? "Use light card" : "Use dark card"}
          onClick={() => updateNodeData(nodeId, { dark: !isDark })}
          className="size-7"
        >
          {isDark ? <SunIcon className="size-3.5" /> : <MoonIcon className="size-3.5" />}
        </IconButton>
        <IconButton
          label="Delete"
          destructive
          onClick={() => deleteNode(nodeId)}
          className="size-7"
        >
          <Trash2Icon className="size-3.5" />
        </IconButton>
      </div>
    </NodeToolbar>
  )
}
