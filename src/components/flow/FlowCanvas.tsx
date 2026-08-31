import { useEffect, useRef, useState } from "react"
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Panel,
  ReactFlow,
  SelectionMode,
  useOnSelectionChange,
  useReactFlow,
  type OnNodeDrag,
} from "@xyflow/react"
import { useStore } from "@/lib/store"
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  type AppNode,
} from "@/lib/types"
import { absoluteRect, findEnclosingFrame, findFrameAt } from "@/lib/geometry"
import { TechNode } from "./TechNode"
import { GroupNode } from "./GroupNode"
import { TextNode } from "./TextNode"
import { TechEdge } from "./TechEdge"
import { ConnectionLine } from "./ConnectionLine"
import { ToolRail } from "./ToolRail"
import { ZoomBar } from "./ZoomBar"
import { AlignBar } from "./AlignBar"
import { LayersPanel } from "./LayersPanel"
import { CanvasEmptyState } from "./CanvasEmptyState"
import { ConnectionFlag } from "./ConnectionFlag"
import { SmartGuides } from "./SmartGuides"
import { computeSmartSnap, type SmartGuide } from "@/lib/smart-guides"

const nodeTypes = {
  tech: TechNode,
  group: GroupNode,
  text: TextNode,
}

const edgeTypes = {
  tech: TechEdge,
}

export function FlowCanvas() {
  const { screenToFlowPosition, fitView, getZoom } = useReactFlow()
  const hasFitted = useRef(false)
  const lastSmartSnap = useRef<{ ids: string[]; dx: number; dy: number } | null>(null)
  const [controlPressed, setControlPressed] = useState(false)
  const [smartGuides, setSmartGuides] = useState<SmartGuide[]>([])

  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const onConnect = useStore((s) => s.onConnect)
  const addTechNode = useStore((s) => s.addTechNode)
  const addGroupNode = useStore((s) => s.addGroupNode)
  const addTextNode = useStore((s) => s.addTextNode)
  const reparentNodes = useStore((s) => s.reparentNodes)
  const duplicateSelectionForDrag = useStore((s) => s.duplicateSelectionForDrag)
  const nudgeDraggedNodes = useStore((s) => s.nudgeDraggedNodes)
  const selectNode = useStore((s) => s.selectNode)
  const selectEdge = useStore((s) => s.selectEdge)
  const clearSelection = useStore((s) => s.clearSelection)
  const tool = useStore((s) => s.tool)
  const setTool = useStore((s) => s.setTool)
  const snapToGrid = useStore((s) => s.snapToGrid)
  const gridSize = useStore((s) => s.gridSize)

  useEffect(() => {
    if (nodes.length === 0 || hasFitted.current) return
    hasFitted.current = true
    const timeout = window.setTimeout(() => fitView({ padding: 0.18, duration: 0 }), 60)
    return () => window.clearTimeout(timeout)
  }, [fitView, nodes.length])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Control") setControlPressed(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== "Control") return
      lastSmartSnap.current = null
      setControlPressed(false)
      setSmartGuides([])
    }
    const onBlur = () => {
      lastSmartSnap.current = null
      setControlPressed(false)
      setSmartGuides([])
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [])

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const slug = e.dataTransfer.getData("application/tech-stack")
    if (!slug) return
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    const frame = findFrameAt(position.x, position.y, useStore.getState().nodes)
    addTechNode(
      slug,
      Math.round(position.x - NODE_WIDTH / 2),
      Math.round(position.y - NODE_HEIGHT / 2),
      frame?.id,
    )
  }

  const onNodeDragStart: OnNodeDrag<AppNode> = (event, node, dragged) => {
    if (tool !== "select" || !("altKey" in event) || !event.altKey) return
    duplicateSelectionForDrag(dragged.length > 0 ? dragged.map((item) => item.id) : [node.id])
  }

  const onNodeDrag: OnNodeDrag<AppNode> = (event, node, dragged) => {
    const ctrlKey = "ctrlKey" in event && event.ctrlKey
    if (tool !== "select" || (!ctrlKey && !controlPressed)) {
      lastSmartSnap.current = null
      if (smartGuides.length > 0) setSmartGuides([])
      return
    }

    const draggedIds = dragged.length > 0 ? dragged.map((item) => item.id) : [node.id]
    const draggedById = new Map(
      (dragged.length > 0 ? dragged : [node]).map((item) => [item.id, item]),
    )
    const proposedNodes = useStore
      .getState()
      .nodes.map((item) => draggedById.get(item.id) ?? item)
    const snap = computeSmartSnap(proposedNodes, draggedIds, 8 / getZoom())
    if (!snap) {
      lastSmartSnap.current = null
      if (smartGuides.length > 0) setSmartGuides([])
      return
    }
    lastSmartSnap.current = { ids: draggedIds, dx: snap.dx, dy: snap.dy }
    nudgeDraggedNodes(draggedIds, snap.dx, snap.dy)
    setSmartGuides(snap.guides)
  }

  const onNodeDragStop: OnNodeDrag<AppNode> = (_e, _node, dragged) => {
    const finalSnap = lastSmartSnap.current
    lastSmartSnap.current = null
    if (finalSnap) nudgeDraggedNodes(finalSnap.ids, finalSnap.dx, finalSnap.dy)
    setSmartGuides([])
    if (dragged.length === 0 || tool !== "select") return
    const nodes = useStore.getState().nodes
    const byId = new Map(nodes.map((n) => [n.id, n]))

    const ignoreIds = new Set<string>()
    for (const d of dragged) {
      ignoreIds.add(d.id)
      for (const n of nodes) {
        if (!n.parentId) continue
        let parent = n.parentId
        const seen = new Set<string>()
        while (parent && !seen.has(parent)) {
          seen.add(parent)
          if (dragged.some((dg) => dg.id === parent)) {
            ignoreIds.add(n.id)
            break
          }
          parent = byId.get(parent)?.parentId ?? ""
        }
      }
    }

    const moves: { id: string; parentId: string | null }[] = []
    for (const d of dragged) {
      const current = byId.get(d.id)
      if (!current || current.draggable === false) continue
      const frame = findEnclosingFrame(absoluteRect(current, byId), nodes, ignoreIds)
      if ((frame?.id ?? null) === (current.parentId ?? null)) continue
      moves.push({ id: current.id, parentId: frame?.id ?? null })
    }
    if (moves.length > 0) reparentNodes(moves)
  }

  const onPaneClick = (e: React.MouseEvent) => {
    if (tool === "frame" || tool === "text") {
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      if (tool === "frame") addGroupNode(Math.round(position.x), Math.round(position.y))
      else addTextNode(Math.round(position.x), Math.round(position.y))
      setTool("select")
      return
    }
    clearSelection()
  }

  useOnSelectionChange({
    onChange: ({ nodes: selNodes, edges: selEdges }) => {
      if (selEdges.length === 1 && selNodes.length === 0) selectEdge(selEdges[0].id)
      else if (selNodes.length === 1) selectNode(selNodes[0].id)
      else clearSelection()
    },
  })

  const paneCursor =
    tool === "pan" ? "cursor-grab active:cursor-grabbing" : tool === "select" ? "" : "cursor-crosshair"

  return (
    <div
      className={`relative size-full @container ${paneCursor}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        defaultEdgeOptions={{ type: "tech", data: { style: "solid" as const } }}
        connectionLineComponent={ConnectionLine}
        connectionMode={ConnectionMode.Loose}
        connectionRadius={28}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.15}
        maxZoom={2.5}
        snapToGrid={snapToGrid && !controlPressed}
        snapGrid={[gridSize, gridSize]}
        deleteKeyCode={null}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag={tool === "select"}
        panOnDrag={tool === "pan" ? true : [1, 2]}
        panOnScroll
        zoomOnDoubleClick={false}
        nodesDraggable={tool === "select"}
        elevateNodesOnSelect
        elevateEdgesOnSelect
        aria-label="Diagram canvas"
      >
        <ConnectionFlag />
        {smartGuides.length > 0 ? <SmartGuides guides={smartGuides} /> : null}
        <Background
          id="minor"
          variant={BackgroundVariant.Lines}
          gap={gridSize}
          lineWidth={1}
          color="var(--grid-minor)"
        />
        <Background
          id="major"
          variant={BackgroundVariant.Lines}
          gap={gridSize * 5}
          lineWidth={1}
          color="var(--grid-major)"
        />

        <Panel position="top-left" className="!m-3">
          <ToolRail />
        </Panel>

        <Panel position="bottom-left" className="!m-3 flex flex-col gap-2 hidden @[560px]:block">
          <LayersPanel />
        </Panel>

        <Panel position="bottom-center" className="!mx-3 !mb-3 hidden @[680px]:block">
          <AlignBar />
        </Panel>

        <Panel position="bottom-right" className="!m-3">
          <ZoomBar />
        </Panel>
      </ReactFlow>

      {nodes.length === 0 ? <CanvasEmptyState /> : null}
    </div>
  )
}
