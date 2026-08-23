import { LoaderIcon, CheckIcon } from "lucide-react"
import type { SaveStatus } from "@/lib/store"

export function SaveStatus({ status }: { status: SaveStatus }) {
  if (status === "idle") return null
  return (
    <p
      aria-live="polite"
      className="ml-3 hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex"
    >
      {status === "saving" ? (
        <>
          <LoaderIcon className="size-3.5 animate-spin" aria-hidden="true" />
          Saving…
        </>
      ) : (
        <>
          <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          All changes saved
        </>
      )}
    </p>
  )
}
