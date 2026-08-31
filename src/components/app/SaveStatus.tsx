import {
  CheckIcon,
  CircleAlertIcon,
  Clock3Icon,
  LoaderIcon,
  RefreshCwIcon,
} from "lucide-react"
import { IconButton } from "@/components/shared/IconButton"
import { toast } from "@/components/ui/toast"
import { useProjectSync } from "@/lib/project-sync"
import { useStore } from "@/lib/store"

export function SaveStatus() {
  const localStatus = useStore((state) => state.saveStatus)
  const projectId = useProjectSync((state) => state.project?.id ?? null)
  const syncStatus = useProjectSync((state) => state.status)
  const syncError = useProjectSync((state) => state.error)
  const syncNow = useProjectSync((state) => state.syncNow)

  const remote = projectId !== null
  const label = remote
    ? syncStatus === "syncing"
      ? "Syncing…"
      : syncStatus === "pending"
        ? "Changes pending"
        : syncStatus === "error"
          ? "Sync failed"
          : "Synced"
    : localStatus === "saving"
      ? "Saving locally…"
      : localStatus === "error"
        ? "Local save failed"
      : "Saved locally"

  const icon = remote ? (
    syncStatus === "syncing" ? (
      <LoaderIcon className="size-3.5 animate-spin" aria-hidden="true" />
    ) : syncStatus === "pending" ? (
      <Clock3Icon className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
    ) : syncStatus === "error" ? (
      <CircleAlertIcon className="size-3.5 text-destructive" aria-hidden="true" />
    ) : (
      <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
    )
  ) : localStatus === "saving" ? (
    <LoaderIcon className="size-3.5 animate-spin" aria-hidden="true" />
  ) : localStatus === "error" ? (
    <CircleAlertIcon className="size-3.5 text-destructive" aria-hidden="true" />
  ) : (
    <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
  )

  const handleSync = () => {
    void syncNow(true).catch((error: unknown) => {
      toast.add({
        type: "error",
        title: "Unable to sync",
        description: error instanceof Error ? error.message : "Check your connection and try again.",
      })
    })
  }

  return (
    <div className="ml-1 flex shrink-0 items-center gap-0.5">
      <p
        role="status"
        title={syncError ?? undefined}
        className="hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex"
      >
        {icon}
        {label}
      </p>
      {remote ? (
        <IconButton
          label={syncStatus === "error" ? "Retry sync" : "Sync now"}
          hint={syncStatus === "error" ? "Retry sync" : "Sync changes now"}
          disabled={syncStatus === "syncing"}
          onClick={handleSync}
          className="size-8 rounded-xl"
        >
          <RefreshCwIcon className="size-3.5" aria-hidden="true" />
        </IconButton>
      ) : null}
    </div>
  )
}
