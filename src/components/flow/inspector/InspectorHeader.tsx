import { CopyIcon, Trash2Icon, XIcon } from "lucide-react"
import { useStore } from "@/lib/store"
import { IconButton } from "@/components/shared/IconButton"

export function InspectorHeader({
  icon,
  title,
  kind,
  onDelete,
  onDuplicate,
}: {
  icon: React.ReactNode
  title: string
  kind: string
  onDelete: () => void
  onDuplicate?: () => void
}) {
  const clearSelection = useStore((s) => s.clearSelection)

  return (
    <header className="flex items-start gap-3 px-5 pt-5 pb-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{kind}</p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {onDuplicate ? (
          <IconButton label="Duplicate" onClick={onDuplicate} className="size-7">
            <CopyIcon className="size-3.5" />
          </IconButton>
        ) : null}
        <IconButton label="Delete" destructive onClick={onDelete} className="size-7">
          <Trash2Icon className="size-3.5" />
        </IconButton>
        <IconButton label="Close inspector" onClick={clearSelection} className="size-7">
          <XIcon className="size-3.5" />
        </IconButton>
      </div>
    </header>
  )
}
