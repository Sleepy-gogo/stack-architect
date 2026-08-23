import { useState } from "react"
import { type NodeProps } from "@xyflow/react"
import { cn } from "@/lib/utils"
import { useStore } from "@/lib/store"
import { resolveSwatch } from "@/lib/swatches"
import type { TextNodeData } from "@/lib/types"

const SIZE_CLASS: Record<string, string> = {
  sm: "text-[13px] leading-snug",
  md: "text-base leading-relaxed",
  lg: "text-xl leading-snug font-semibold tracking-tight",
}

export function TextNode({ id, data, selected }: NodeProps) {
  const d = data as TextNodeData
  const sizeClass = SIZE_CLASS[d.size ?? "md"] ?? SIZE_CLASS.md
  const updateNodeData = useStore((s) => s.updateNodeData)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(d.text)

  const startEditing = () => {
    setDraft(d.text)
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    if (draft !== d.text) updateNodeData(id, { text: draft })
  }

  const cancel = () => {
    setDraft(d.text)
    setEditing(false)
  }

  return (
    <div
      className={cn(
        "w-[200px] cursor-text rounded-lg px-1.5 py-1 transition-shadow hover:bg-muted/40",
        selected &&
          "shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_28%,transparent)]",
      )}
      onDoubleClick={startEditing}
    >
      {editing ? (
        <textarea
          value={draft}
          aria-label="Text content"
          rows={3}
          autoFocus
          className={cn("nodrag nowheel w-full resize-none bg-transparent outline-none", sizeClass)}
          style={{ color: resolveSwatch(d.color) }}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel()
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit()
          }}
        />
      ) : (
        <p
          className={cn("whitespace-pre-wrap outline-none", sizeClass)}
          style={{ color: resolveSwatch(d.color) }}
        >
          {d.text || (
            <span className="text-muted-foreground italic">Empty text</span>
          )}
        </p>
      )}
    </div>
  )
}
