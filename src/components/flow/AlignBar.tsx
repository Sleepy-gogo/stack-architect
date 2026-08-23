import { useReactFlow } from "@xyflow/react"
import {
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  AlignEndHorizontalIcon,
  AlignEndVerticalIcon,
  AlignHorizontalSpaceAroundIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  AlignVerticalSpaceAroundIcon,
  GridIcon,
  MagnetIcon,
  SparklesIcon,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { layoutDagre } from "@/lib/layout"
import { cn } from "@/lib/utils"
import { BarButton } from "./BarButton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ALIGN_ACTIONS = [
  { id: "left", label: "Align left", icon: AlignStartVerticalIcon },
  { id: "center-x", label: "Align horizontal centers", icon: AlignCenterVerticalIcon },
  { id: "right", label: "Align right", icon: AlignEndVerticalIcon },
  { id: "top", label: "Align top", icon: AlignStartHorizontalIcon },
  { id: "center-y", label: "Align vertical centers", icon: AlignCenterHorizontalIcon },
  { id: "bottom", label: "Align bottom", icon: AlignEndHorizontalIcon },
] as const

const GRID_SIZES = [4, 8, 16, 20]

export function AlignBar() {
  const { fitView } = useReactFlow()
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const loadDocument = useStore((s) => s.loadDocument)
  const alignSelection = useStore((s) => s.alignSelection)
  const distributeSelection = useStore((s) => s.distributeSelection)
  const snapToGrid = useStore((s) => s.snapToGrid)
  const setSnapToGrid = useStore((s) => s.setSnapToGrid)
  const gridSize = useStore((s) => s.gridSize)
  const setGridSize = useStore((s) => s.setGridSize)

  const selectedCount = nodes.filter((n) => n.selected).length
  const canAlign = selectedCount >= 2
  const canDistribute = selectedCount >= 3

  const autoArrange = () => {
    loadDocument({ ...layoutDagre({ nodes, edges }), title: undefined })
    window.setTimeout(() => fitView({ padding: 0.18, duration: 300 }), 60)
  }

  return (
    <div
      role="toolbar"
      aria-label="Arrange"
      className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-border bg-card/95 p-1.5 shadow-[0_2px_6px_-2px_rgb(15_23_42/0.12),0_12px_28px_-16px_rgb(15_23_42/0.35)] backdrop-blur-sm"
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={autoArrange}
              disabled={nodes.length === 0}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
            />
          }
        >
          <SparklesIcon className="size-3.5 text-primary" />
          Auto
        </TooltipTrigger>
        <TooltipContent>Lay the whole diagram out left to right</TooltipContent>
      </Tooltip>

      <div className="mx-0.5 h-5 w-px bg-border" />

      {ALIGN_ACTIONS.map(({ id, label, icon: Icon }) => (
        <BarButton
          key={id}
          label={label}
          disabled={!canAlign}
          disabledHint="Select at least two objects"
          onClick={() => alignSelection(id)}
        >
          <Icon className="size-4" />
        </BarButton>
      ))}

      <div className="mx-0.5 h-5 w-px bg-border" />

      <BarButton
        label="Distribute horizontally"
        disabled={!canDistribute}
        disabledHint="Select at least three objects"
        onClick={() => distributeSelection("horizontal")}
      >
        <AlignHorizontalSpaceAroundIcon className="size-4" />
      </BarButton>
      <BarButton
        label="Distribute vertically"
        disabled={!canDistribute}
        disabledHint="Select at least three objects"
        onClick={() => distributeSelection("vertical")}
      >
        <AlignVerticalSpaceAroundIcon className="size-4" />
      </BarButton>

      <div className="mx-0.5 h-5 w-px bg-border" />

      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-pressed={snapToGrid}
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                snapToGrid
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            />
          }
        >
          <MagnetIcon className="size-3.5" />
          Snap
        </TooltipTrigger>
        <TooltipContent>{snapToGrid ? "Snapping is on" : "Snapping is off"}</TooltipContent>
      </Tooltip>

      <div className="flex h-8 items-center gap-1.5 rounded-lg pl-1.5 pr-1 text-xs text-muted-foreground">
        <GridIcon className="size-3.5" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Grid</span>
        <Select
          value={gridSize}
          onValueChange={(value) => setGridSize(value as number)}
          items={GRID_SIZES.map((size) => ({ value: size, label: `${size}px` }))}
        >
          <SelectTrigger
            size="sm"
            aria-label="Grid size in pixels"
            className="h-6 gap-1 rounded-md border-border bg-transparent px-1.5 font-mono text-[11px] tabular-nums"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRID_SIZES.map((size) => (
              <SelectItem key={size} value={size} className="font-mono text-xs tabular-nums">
                {size}px
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
