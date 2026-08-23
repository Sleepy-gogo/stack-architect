import { FrameIcon, HandIcon, MousePointer2Icon, TypeIcon } from "lucide-react"
import { useStore, type Tool } from "@/lib/store"
import { cn } from "@/lib/utils"
import { IconButton } from "@/components/shared/IconButton"

type ToolSpec = {
  id: Tool
  label: string
  hint: string
  shortcut: string
  icon: React.ComponentType<{ className?: string }>
}

const TOOLS: ToolSpec[] = [
  { id: "select", label: "Select", hint: "Move and edit objects", shortcut: "V", icon: MousePointer2Icon },
  { id: "pan", label: "Pan", hint: "Drag to move the canvas", shortcut: "H", icon: HandIcon },
  { id: "frame", label: "Frame", hint: "Click the canvas to draw a frame", shortcut: "F", icon: FrameIcon },
  { id: "text", label: "Text", hint: "Click the canvas to drop floating text", shortcut: "N", icon: TypeIcon },
]

export function ToolRail() {
  const tool = useStore((s) => s.tool)
  const setTool = useStore((s) => s.setTool)

  return (
    <div
      role="toolbar"
      aria-label="Canvas tools"
      aria-orientation="vertical"
      className="pointer-events-auto flex flex-col gap-1 rounded-2xl border border-border bg-card/95 p-1.5 shadow-[0_2px_6px_-2px_rgb(15_23_42/0.12),0_12px_28px_-16px_rgb(15_23_42/0.35)] backdrop-blur-sm"
    >
      {TOOLS.map(({ id, label, hint, shortcut, icon: Icon }) => {
        const active = tool === id
        return (
          <IconButton
            key={id}
            label={`${label} tool`}
            hint={hint}
            shortcut={shortcut}
            pressed={active}
            side="right"
            onClick={() => setTool(id)}
            className={cn(
              "size-9 rounded-xl",
              active &&
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            )}
          >
            <Icon className="size-4" />
          </IconButton>
        )
      })}
    </div>
  )
}
