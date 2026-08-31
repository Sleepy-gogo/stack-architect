import { useRef, useState } from "react"
import { useReactFlow } from "@xyflow/react"
import {
  ChevronRightIcon,
  DownloadIcon,
  FileJsonIcon,
  ImageIcon,
  LoaderIcon,
  MoonIcon,
  PanelLeftIcon,
  PanelRightIcon,
  Redo2Icon,
  Share2Icon,
  ShapesIcon,
  SunIcon,
  Undo2Icon,
  UploadIcon,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { EmptyDiagramError, exportImage, exportJson, readJsonFile } from "@/lib/export"
import { IconButton } from "@/components/shared/IconButton"
import { TitleField } from "@/components/app/TitleField"
import { SaveStatus } from "@/components/app/SaveStatus"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/toast"
import { createSharedProject, sharedProjectUrl } from "@/lib/share"
import { useProjectSync } from "@/lib/project-sync"

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const input = document.createElement("textarea")
  input.value = value
  input.setAttribute("readonly", "")
  input.style.position = "fixed"
  input.style.opacity = "0"
  document.body.append(input)
  input.select()
  const copied = document.execCommand("copy")
  input.remove()
  if (!copied) throw new Error("Your browser blocked clipboard access.")
}

export function TopBar({
  dark,
  onToggleDark,
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
}: {
  dark: boolean
  onToggleDark: () => void
  leftOpen: boolean
  rightOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
}) {
  const title = useStore((s) => s.title)
  const setTitle = useStore((s) => s.setTitle)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const exportDocument = useStore((s) => s.exportDocument)
  const loadDocument = useStore((s) => s.loadDocument)
  const projectId = useProjectSync((s) => s.project?.id ?? null)
  const attachProject = useProjectSync((s) => s.attachProject)
  const syncNow = useProjectSync((s) => s.syncNow)
  const { fitView } = useReactFlow()

  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [exportGrid, setExportGrid] = useState(false)
  const [exportTransparent, setExportTransparent] = useState(false)

  const handleExportImage = async (format: "png" | "svg") => {
    setBusy(true)
    try {
      const { nodes, title, gridSize } = useStore.getState()
      await exportImage(nodes, title, format, {
        grid: exportGrid,
        transparent: exportTransparent,
        gridSize,
      })
    } catch (error) {
      toast.add({
        type: "error",
        title:
          error instanceof EmptyDiagramError
            ? "Nothing to export"
            : `Could not export the ${format.toUpperCase()}`,
        description:
          error instanceof Error ? error.message : "Something went wrong while rendering.",
      })
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const doc = await readJsonFile(file)
      loadDocument(doc)
      window.setTimeout(() => fitView({ padding: 0.18, duration: 300 }), 60)
      toast.add({ type: "success", title: "Diagram imported" })
    } catch (error) {
      toast.add({
        type: "error",
        title: "Could not import that file",
        description:
          error instanceof Error ? error.message : "The file is not a diagram this editor wrote.",
      })
    } finally {
      e.target.value = ""
    }
  }

  const handleShare = async () => {
    setSharing(true)
    try {
      let url: string
      if (projectId) {
        await syncNow(true)
        url = sharedProjectUrl(projectId)
      } else {
        const document = exportDocument()
        const project = await createSharedProject(document)
        attachProject(project.id, project.editToken, document)
        url = project.url
      }
      await copyText(url)
      toast.add({
        type: "success",
        title: "Share link copied",
        description: "Anyone with the link can open this snapshot.",
      })
    } catch (error) {
      toast.add({
        type: "error",
        title: "Could not create a share link",
        description:
          error instanceof Error ? error.message : "The diagram could not be copied to a link.",
      })
    } finally {
      setSharing(false)
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-2 sm:px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-foreground text-background"
        >
          <ShapesIcon className="size-4" />
        </span>
        <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">
          Stack Architect
        </span>
        <ChevronRightIcon
          className="hidden size-4 shrink-0 text-muted-foreground/60 md:inline"
          aria-hidden="true"
        />
        <TitleField value={title} onChange={setTitle} />
      </div>

      <SaveStatus />

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <IconButton
          label="Undo"
          shortcut="⌘Z"
          disabled={!canUndo}
          onClick={undo}
          className="hidden size-8 rounded-xl sm:inline-flex"
        >
          <Undo2Icon className="size-4" />
        </IconButton>
        <IconButton
          label="Redo"
          shortcut="⇧⌘Z"
          disabled={!canRedo}
          onClick={redo}
          className="hidden size-8 rounded-xl sm:inline-flex"
        >
          <Redo2Icon className="size-4" />
        </IconButton>

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <IconButton
          label={dark ? "Switch to light theme" : "Switch to dark theme"}
          onClick={onToggleDark}
          className="size-8 rounded-xl"
        >
          {dark ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
        </IconButton>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sharing}
          onClick={handleShare}
          className="ml-1 rounded-xl px-2.5"
        >
          {sharing ? (
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Share2Icon className="size-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">{sharing ? "Saving…" : "Share"}</span>
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleImport}
        />
        <IconButton
          label="Import a diagram file"
          onClick={() => fileRef.current?.click()}
          className="hidden size-8 rounded-xl md:inline-flex"
        >
          <UploadIcon className="size-4" />
        </IconButton>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button size="sm" disabled={busy} className="ml-1 rounded-xl" />}
          >
            {busy ? (
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <DownloadIcon className="size-4" aria-hidden="true" />
            )}
            {busy ? "Exporting…" : "Export"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-2xl">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Image options</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={exportGrid && !exportTransparent}
                disabled={exportTransparent}
                onCheckedChange={(checked) => setExportGrid(checked)}
              >
                Show grid
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={exportTransparent}
                onCheckedChange={(checked) => setExportTransparent(checked)}
              >
                Transparent background
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExportImage("png")}>
              <ImageIcon />
              PNG image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExportImage("svg")}>
              <ImageIcon />
              SVG vector
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportJson(exportDocument(), title)}>
              <FileJsonIcon />
              JSON source
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-5 w-px bg-border" />

        <IconButton
          label={leftOpen ? "Hide the assets panel" : "Show the assets panel"}
          pressed={leftOpen}
          onClick={onToggleLeft}
          className="size-8 rounded-xl"
        >
          <PanelLeftIcon className="size-4" />
        </IconButton>
        <IconButton
          label={rightOpen ? "Hide the inspector" : "Show the inspector"}
          pressed={rightOpen}
          onClick={onToggleRight}
          className="size-8 rounded-xl"
        >
          <PanelRightIcon className="size-4" />
        </IconButton>
      </div>
    </header>
  )
}
