import { create } from "zustand"
import {
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from "@xyflow/react"
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  type AppEdge,
  type AppNode,
  type GraphDocument,
  type TechNodeData,
} from "./types"
import { techCatalog } from "./catalog"
import { absolutePosition, nodeSize } from "./geometry"

const STORAGE_KEY = "tech-stack-architect:doc"
const RECENT_KEY = "tech-stack-architect:recent"
const HISTORY_LIMIT = 60

let idCounter = 0
function genId(prefix = "n"): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`
}

/* ------------------------------------------------------------------ */
/* Clipboard                                                           */
/* ------------------------------------------------------------------ */

let clipboard: { nodes: AppNode[]; edges: AppEdge[] } | null = null
let pasteCounter = 0

function ancestorsOf(node: AppNode, nodes: AppNode[]): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const chain: string[] = []
  let parentId = node.parentId
  const seen = new Set<string>()
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    chain.push(parentId)
    parentId = byId.get(parentId)?.parentId
  }
  return chain
}

/** Stable sort so every parent sits before its children in the array. */
function orderParentsFirst(nodes: AppNode[]): AppNode[] {
  const depthOf = (node: AppNode): number => ancestorsOf(node, nodes).length
  return [...nodes].sort((a, b) => depthOf(a) - depthOf(b))
}

/** Clear the selection flag without touching anything else on the item. */
function deselect<T extends { selected?: boolean }>(item: T): T {
  return item.selected ? { ...item, selected: false } : item
}

/** A frame and everything nested inside it, however deep. */
function collectDescendants(ids: string[], nodes: AppNode[]): Set<string> {
  const removed = new Set(ids)
  let grew = true
  while (grew) {
    grew = false
    for (const n of nodes) {
      if (removed.has(n.id)) continue
      if (n.parentId && removed.has(n.parentId)) {
        removed.add(n.id)
        grew = true
      }
    }
  }
  return removed
}

export type Tool = "select" | "pan" | "frame" | "text"

type Snapshot = { nodes: AppNode[]; edges: AppEdge[] }

export type SaveStatus = "saved" | "saving" | "error" | "idle"

type State = {
  title: string
  nodes: AppNode[]
  edges: AppEdge[]
  selectedNodeId: string | null
  selectedEdgeId: string | null

  tool: Tool
  snapToGrid: boolean
  gridSize: number
  recent: string[]

  past: Snapshot[]
  future: Snapshot[]
  saveStatus: SaveStatus

  setTitle: (title: string) => void
  setTool: (tool: Tool) => void
  setSnapToGrid: (snap: boolean) => void
  setGridSize: (size: number) => void

  onNodesChange: OnNodesChange<AppNode>
  onEdgesChange: OnEdgesChange<AppEdge>
  onConnect: OnConnect

  addTechNode: (slug: string, x: number, y: number, parentId?: string) => string
  addGroupNode: (x: number, y: number, w?: number, h?: number) => string
  addTextNode: (x: number, y: number) => string
  updateNodeData: (id: string, patch: Record<string, unknown>) => void
  moveNode: (id: string, axis: "x" | "y", value: number) => void
  setNodeFlag: (id: string, flag: "hidden" | "locked", value: boolean) => void
  deleteNode: (id: string) => void
  deleteSelection: () => void
  duplicateNode: (id: string) => void
  duplicateSelectionForDrag: (draggedIds: string[]) => void
  nudgeDraggedNodes: (draggedIds: string[], dx: number, dy: number) => void

  /** Move nodes into a frame (or out to the canvas), keeping their visual position. */
  reparentNodes: (moves: { id: string; parentId: string | null }[]) => void

  nudgeSelection: (dx: number, dy: number) => void
  selectAll: () => void
  copySelection: () => void
  cutSelection: () => void
  pasteClipboard: () => void

  updateEdge: (id: string, patch: Partial<NonNullable<AppEdge["data"]>>) => void
  /** Retarget an edge endpoint onto another object and patch its data in one commit. */
  setEdgeRoute: (
    id: string,
    route: { source?: string; target?: string },
    dataPatch: Partial<NonNullable<AppEdge["data"]>>,
  ) => void
  deleteEdge: (id: string) => void

  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void
  clearSelection: () => void
  deselectAll: () => void
  focusNode: (id: string) => void

  alignSelection: (axis: "left" | "center-x" | "right" | "top" | "center-y" | "bottom") => void
  distributeSelection: (axis: "horizontal" | "vertical") => void

  undo: () => void
  redo: () => void

  loadDocument: (doc: GraphDocument, options?: { resetHistory?: boolean }) => void
  exportDocument: () => GraphDocument
  clearAll: () => void
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

let saveTimer: number | undefined

function scheduleSave(get: () => State, set: (patch: Partial<State>) => void) {
  if (typeof window === "undefined") return
  set({ saveStatus: "saving" })
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try {
      const { title, nodes, edges, recent } = get()
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, title, nodes, edges }),
      )
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
      set({ saveStatus: "saved" })
    } catch {
      // Storage can be full or blocked (private mode); the canvas still works.
      set({ saveStatus: "error" })
    }
  }, 500)
}

export function readStoredDocument(): GraphDocument | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const doc = JSON.parse(raw) as GraphDocument
    if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) return null
    return doc
  } catch {
    return null
  }
}

function readStoredRecent(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(RECENT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return Array.isArray(parsed) ? (parsed as string[]).slice(0, 8) : []
  } catch {
    return []
  }
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

export const useStore = create<State>((set, get) => {
  /** Push the current graph onto the undo stack, then apply `patch`. */
  const commit = (patch: Partial<State>) => {
    const { nodes, edges, past } = get()
    set({
      ...patch,
      past: [...past, { nodes, edges }].slice(-HISTORY_LIMIT),
      future: [],
    })
    scheduleSave(get, set)
  }

  /** Snapshot taken when a drag or resize gesture begins. */
  let gestureSnapshot: Snapshot | null = null

  return {
    title: "Untitled diagram",
    nodes: [],
    edges: [],
    selectedNodeId: null,
    selectedEdgeId: null,

    tool: "select",
    snapToGrid: true,
    gridSize: 8,
    recent: readStoredRecent(),

    past: [],
    future: [],
    saveStatus: "idle",

    setTitle: (title) => {
      set({ title })
      scheduleSave(get, set)
    },
    setTool: (tool) => set({ tool }),
    setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
    setGridSize: (gridSize) => set({ gridSize }),

    onNodesChange: (changes) => {
      const startsGesture = changes.some(
        (c) =>
          (c.type === "position" && c.dragging === true) ||
          (c.type === "dimensions" && c.resizing === true),
      )
      const endsGesture = changes.some(
        (c) =>
          (c.type === "position" && c.dragging === false) ||
          (c.type === "dimensions" && c.resizing === false),
      )

      if (startsGesture && !gestureSnapshot) {
        const { nodes, edges } = get()
        gestureSnapshot = { nodes, edges }
      }

      set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) as AppNode[] }))

      if (endsGesture && gestureSnapshot) {
        const snapshot = gestureSnapshot
        gestureSnapshot = null
        set((s) => ({
          past: [...s.past, snapshot].slice(-HISTORY_LIMIT),
          future: [],
        }))
        scheduleSave(get, set)
      }
    },

    onEdgesChange: (changes) =>
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) as AppEdge[] })),

    onConnect: (connection) => {
      const { edges } = get()
      // Ignore duplicate connections between the same pair of handles.
      const exists = edges.some(
        (e) =>
          e.source === connection.source &&
          e.target === connection.target &&
          e.sourceHandle === connection.sourceHandle &&
          e.targetHandle === connection.targetHandle,
      )
      if (exists) return
      commit({
        edges: addEdge(
          { ...connection, id: genId("e"), type: "tech", data: { style: "solid" } },
          edges,
        ) as AppEdge[],
      })
    },

    addTechNode: (slug, x, y, parentId) => {
      const item = techCatalog.find((t) => t.slug === slug)
      const id = genId("tech")
      let position = { x, y }
      if (parentId) {
        const byId = new Map(get().nodes.map((n) => [n.id, n]))
        const parent = byId.get(parentId)
        if (parent) {
          const origin = absolutePosition(parent, byId)
          position = { x: x - origin.x, y: y - origin.y }
        } else {
          parentId = undefined
        }
      }
      const data: TechNodeData = {
        slug,
        name: item?.name ?? slug,
        subtitle: item?.subtitle ?? "",
        category: item?.category ?? "frontend",
      }
      const node: AppNode = {
        id,
        type: "tech",
        position,
        parentId,
        data,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      }
      const recent = [slug, ...get().recent.filter((s) => s !== slug)].slice(0, 8)
      commit({
        nodes: orderParentsFirst([...get().nodes.map(deselect), node]),
        selectedNodeId: id,
        selectedEdgeId: null,
        recent,
      })
      return id
    },

    addGroupNode: (x, y, w = 460, h = 300) => {
      const id = genId("group")
      const node: AppNode = {
        id,
        type: "group",
        position: { x, y },
        data: { label: "New frame", color: "#3b82f6", dashed: false },
        width: w,
        height: h,
        style: { width: w, height: h },
      }
      commit({
        nodes: [node, ...get().nodes.map(deselect)],
        selectedNodeId: id,
        selectedEdgeId: null,
      })
      return id
    },

    addTextNode: (x, y) => {
      const id = genId("text")
      const node: AppNode = {
        id,
        type: "text",
        position: { x, y },
        data: { text: "Double-click to edit this text", size: "md" },
        width: 200,
      }
      commit({
        nodes: [...get().nodes.map(deselect), node],
        selectedNodeId: id,
        selectedEdgeId: null,
      })
      return id
    },

    updateNodeData: (id, patch) =>
      commit({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
      }),

    moveNode: (id, axis, value) => {
      if (!Number.isFinite(value)) return
      commit({
        nodes: get().nodes.map((n) =>
          n.id === id ? { ...n, position: { ...n.position, [axis]: value } } : n,
        ),
      })
    },

    setNodeFlag: (id, flag, value) =>
      commit({
        nodes: get().nodes.map((n) => {
          if (n.id !== id) return n
          if (flag === "hidden") return { ...n, hidden: value }
          return { ...n, draggable: !value, selectable: !value, data: { ...n.data, locked: value } }
        }),
      }),

    deleteNode: (id) => {
      const { nodes, edges, selectedNodeId } = get()
      const removed = collectDescendants([id], nodes)
      commit({
        nodes: nodes.filter((n) => !removed.has(n.id)),
        edges: edges.filter((e) => !removed.has(e.source) && !removed.has(e.target)),
        selectedNodeId: selectedNodeId && removed.has(selectedNodeId) ? null : selectedNodeId,
      })
    },

    deleteSelection: () => {
      const { nodes, edges } = get()
      const selectedNodes = nodes.filter((n) => n.selected)
      const selectedEdges = edges.filter((e) => e.selected)
      if (selectedNodes.length === 0 && selectedEdges.length === 0) return

      const removed = collectDescendants(
        selectedNodes.map((n) => n.id),
        nodes,
      )
      const removedEdges = new Set(selectedEdges.map((e) => e.id))

      commit({
        nodes: nodes.filter((n) => !removed.has(n.id)),
        edges: edges.filter(
          (e) => !removedEdges.has(e.id) && !removed.has(e.source) && !removed.has(e.target),
        ),
        selectedNodeId: null,
        selectedEdgeId: null,
      })
    },

    duplicateNode: (id) => {
      const node = get().nodes.find((n) => n.id === id)
      if (!node) return
      const newId = genId(node.type ?? "node")
      const copy: AppNode = {
        ...node,
        id: newId,
        position: { x: node.position.x + 32, y: node.position.y + 32 },
        data: { ...node.data },
        selected: true,
      }
      commit({
        nodes: [...get().nodes.map(deselect), copy],
        selectedNodeId: newId,
        selectedEdgeId: null,
      })
    },

    duplicateSelectionForDrag: (draggedIds) => {
      if (draggedIds.length === 0) return
      const { nodes, edges } = get()
      const roots = new Set(draggedIds)
      const copiedIds = new Set(roots)

      let grew = true
      while (grew) {
        grew = false
        for (const node of nodes) {
          if (copiedIds.has(node.id) || !node.parentId || !copiedIds.has(node.parentId)) continue
          copiedIds.add(node.id)
          grew = true
        }
      }

      const copiedNodes = nodes.filter((node) => copiedIds.has(node.id))
      if (copiedNodes.length === 0) return

      if (!gestureSnapshot) gestureSnapshot = { nodes, edges }

      const idMap = new Map<string, string>()
      for (const node of copiedNodes) idMap.set(node.id, genId(node.type ?? "node"))

      const clones = copiedNodes.map((node) => ({
        ...node,
        id: idMap.get(node.id) ?? node.id,
        parentId: node.parentId ? (idMap.get(node.parentId) ?? node.parentId) : undefined,
        position: { ...node.position },
        data: { ...node.data },
        selected: false,
        dragging: false,
      }))
      const clonedEdges = edges
        .filter((edge) => copiedIds.has(edge.source) && copiedIds.has(edge.target))
        .map((edge) => ({
          ...edge,
          id: genId("e"),
          source: idMap.get(edge.source) ?? edge.source,
          target: idMap.get(edge.target) ?? edge.target,
          data: edge.data ? { ...edge.data } : edge.data,
          selected: false,
        }))

      set({
        nodes: [...nodes, ...orderParentsFirst(clones)],
        edges: [...edges, ...clonedEdges],
      })
    },

    nudgeDraggedNodes: (draggedIds, dx, dy) => {
      if ((!dx && !dy) || draggedIds.length === 0) return
      const moved = new Set(draggedIds)
      set((state) => ({
        nodes: state.nodes.map((node) =>
          moved.has(node.id) && !(node.parentId && moved.has(node.parentId))
            ? {
                ...node,
                position: { x: node.position.x + dx, y: node.position.y + dy },
              }
            : node,
        ),
      }))
    },

    reparentNodes: (moves) => {
      if (moves.length === 0) return
      const nodes = get().nodes
      const byId = new Map(nodes.map((n) => [n.id, n]))

      const isDescendant = (id: string, maybeAncestor: string): boolean => {
        let parentId = byId.get(id)?.parentId
        const seen = new Set<string>()
        while (parentId && !seen.has(parentId)) {
          seen.add(parentId)
          if (parentId === maybeAncestor) return true
          parentId = byId.get(parentId)?.parentId
        }
        return false
      }

      const patch = new Map<string, AppNode>()
      for (const move of moves) {
        const node = patch.get(move.id) ?? byId.get(move.id)
        if (!node) continue
        if (move.parentId === node.parentId) continue
        if (move.parentId && (move.parentId === node.id || isDescendant(move.parentId, node.id)))
          continue

        const abs = absolutePosition(node, byId)
        let parentId: string | undefined
        let position = abs
        if (move.parentId) {
          const parent = patch.get(move.parentId) ?? byId.get(move.parentId)
          if (!parent || parent.type !== "group") continue
          const origin = absolutePosition(parent, byId)
          parentId = move.parentId
          position = { x: abs.x - origin.x, y: abs.y - origin.y }
        }

        patch.set(node.id, {
          ...node,
          parentId,
          // No `extent: "parent"` here — React Flow would clamp the node inside
          // its frame forever, making it impossible to drag back out. Leaving
          // the frame is handled by the drag-stop hit test instead.
          position,
        })
      }
      if (patch.size === 0) return

      commit({
        nodes: orderParentsFirst(nodes.map((n) => patch.get(n.id) ?? n)),
      })
    },

    nudgeSelection: (dx, dy) => {
      const { nodes } = get()
      const selected = new Set(nodes.filter((n) => n.selected).map((n) => n.id))
      if (selected.size === 0) return
      // A frame and a child inside it can both be selected; moving the frame
      // already carries the child, so only move top-most selected objects.
      const moved = new Set(
        nodes.filter((n) => selected.has(n.id) && !(n.parentId && selected.has(n.parentId))).map((n) => n.id),
      )
      commit({
        nodes: nodes.map((n) =>
          moved.has(n.id)
            ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
            : n,
        ),
      })
    },

    selectAll: () =>
      set((s) => ({
        nodes: s.nodes.map((n) => (n.hidden ? n : { ...n, selected: true })),
        edges: s.edges.map((e) => ({ ...e, selected: false })),
      })),

    copySelection: () => {
      const { nodes, edges } = get()
      const selectedIds = new Set<string>()
      for (const n of nodes) if (n.selected) selectedIds.add(n.id)
      // Children of a copied frame travel with it.
      for (const id of selectedIds)
        for (const n of nodes) if (n.parentId && ancestorsOf(n, nodes).includes(id)) selectedIds.add(n.id)

      const copiedNodes = nodes
        .filter((n) => selectedIds.has(n.id))
        .map((n) => ({ ...n, selected: false }))
      const copiedEdges = edges
        .filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target))
        .map((e) => ({ ...e, selected: false }))
      clipboard = { nodes: copiedNodes, edges: copiedEdges }
    },

    cutSelection: () => {
      get().copySelection()
      get().deleteSelection()
    },

    pasteClipboard: () => {
      if (!clipboard || clipboard.nodes.length === 0) return
      const { nodes, edges } = get()

      const idMap = new Map<string, string>()
      for (const n of clipboard.nodes) idMap.set(n.id, genId(n.type ?? "node"))

      // Paste near the original, nudged so repeated pastes fan out.
      const pasteCount = pasteCounter++ % 6
      const offset = 32 + pasteCount * 24

      const pastedNodes = clipboard.nodes.map((n) => ({
        ...n,
        id: idMap.get(n.id) ?? n.id,
        // A copied child keeps its relative slot inside the copied frame.
        parentId: n.parentId ? (idMap.get(n.parentId) ?? n.parentId) : undefined,
        position: { x: n.position.x + offset, y: n.position.y + offset },
        selected: true,
      }))
      const pastedEdges = clipboard.edges.map((e) => ({
        ...e,
        id: genId("e"),
        source: idMap.get(e.source) ?? e.source,
        target: idMap.get(e.target) ?? e.target,
        selected: false,
      }))

      const firstPasted = pastedNodes.find((n) => !n.parentId)
      commit({
        nodes: [...nodes.map(deselect), ...orderParentsFirst(pastedNodes)],
        edges: [...edges.map(deselect), ...pastedEdges],
        selectedNodeId: firstPasted?.id ?? null,
        selectedEdgeId: null,
      })
    },

    updateEdge: (id, patch) =>
      commit({
        edges: get().edges.map((e) =>
          e.id === id ? { ...e, data: { ...e.data, ...patch } } : e,
        ),
      }),

    /** Move an edge endpoint onto another object and patch its data once. */
    setEdgeRoute: (id, route, dataPatch) =>
      commit({
        edges: get().edges.map((e) =>
          e.id === id ? { ...e, ...route, data: { ...(e.data ?? {}), ...dataPatch } } : e,
        ),
      }),

    deleteEdge: (id) => {
      const { edges, selectedEdgeId } = get()
      commit({
        edges: edges.filter((e) => e.id !== id),
        selectedEdgeId: selectedEdgeId === id ? null : selectedEdgeId,
      })
    },

    selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
    selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
    clearSelection: () => set({ selectedNodeId: null, selectedEdgeId: null }),

    deselectAll: () =>
      set((s) => ({
        selectedNodeId: null,
        selectedEdgeId: null,
        nodes: s.nodes.some((n) => n.selected) ? s.nodes.map(deselect) : s.nodes,
        edges: s.edges.some((e) => e.selected) ? s.edges.map(deselect) : s.edges,
      })),

    focusNode: (id) =>
      set((s) => ({
        selectedNodeId: id,
        selectedEdgeId: null,
        nodes: s.nodes.map((n) => ({ ...n, selected: n.id === id })),
      })),

    alignSelection: (axis) => {
      const { nodes } = get()
      const selected = nodes.filter((n) => n.selected)
      if (selected.length < 2) return

      const boxes = selected.map((n) => ({ id: n.id, ...nodeSize(n), pos: n.position }))
      const minX = Math.min(...boxes.map((b) => b.pos.x))
      const maxX = Math.max(...boxes.map((b) => b.pos.x + b.w))
      const minY = Math.min(...boxes.map((b) => b.pos.y))
      const maxY = Math.max(...boxes.map((b) => b.pos.y + b.h))
      const midX = (minX + maxX) / 2
      const midY = (minY + maxY) / 2

      const next = nodes.map((n) => {
        if (!n.selected) return n
        const { w, h } = nodeSize(n)
        switch (axis) {
          case "left":
            return { ...n, position: { ...n.position, x: minX } }
          case "right":
            return { ...n, position: { ...n.position, x: maxX - w } }
          case "center-x":
            return { ...n, position: { ...n.position, x: midX - w / 2 } }
          case "top":
            return { ...n, position: { ...n.position, y: minY } }
          case "bottom":
            return { ...n, position: { ...n.position, y: maxY - h } }
          case "center-y":
            return { ...n, position: { ...n.position, y: midY - h / 2 } }
        }
      })
      commit({ nodes: next })
    },

    distributeSelection: (axis) => {
      const { nodes } = get()
      const selected = nodes.filter((n) => n.selected)
      if (selected.length < 3) return

      const key = axis === "horizontal" ? "x" : "y"
      const sorted = [...selected].sort((a, b) => a.position[key] - b.position[key])
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const lastSize = axis === "horizontal" ? nodeSize(last).w : nodeSize(last).h

      const span = last.position[key] + lastSize - first.position[key]
      const totalSize = sorted.reduce(
        (sum, n) => sum + (axis === "horizontal" ? nodeSize(n).w : nodeSize(n).h),
        0,
      )
      const gap = (span - totalSize) / (sorted.length - 1)

      const positions = new Map<string, number>()
      let cursor = first.position[key]
      for (const n of sorted) {
        positions.set(n.id, cursor)
        cursor += (axis === "horizontal" ? nodeSize(n).w : nodeSize(n).h) + gap
      }

      commit({
        nodes: nodes.map((n) => {
          const value = positions.get(n.id)
          if (value === undefined) return n
          return { ...n, position: { ...n.position, [key]: value } }
        }),
      })
    },

    undo: () => {
      const { past, future, nodes, edges } = get()
      if (past.length === 0) return
      const previous = past[past.length - 1]
      set({
        nodes: previous.nodes,
        edges: previous.edges,
        past: past.slice(0, -1),
        future: [{ nodes, edges }, ...future].slice(0, HISTORY_LIMIT),
      })
      scheduleSave(get, set)
    },

    redo: () => {
      const { past, future, nodes, edges } = get()
      if (future.length === 0) return
      const next = future[0]
      set({
        nodes: next.nodes,
        edges: next.edges,
        past: [...past, { nodes, edges }].slice(-HISTORY_LIMIT),
        future: future.slice(1),
      })
      scheduleSave(get, set)
    },

    loadDocument: (doc, options) => {
      const nodes = (doc.nodes ?? []).map((n) => ({
        ...n,
        // Documents saved before the note→text rename keep working.
        type: n.type === "note" ? "text" : n.type,
        selected: false,
        // Older saves clamp children to their frame; dragging out is a feature.
        extent: undefined,
        data: n.data ?? {},
      })) as AppNode[]
      const edges = (doc.edges ?? []).map((e) => ({
        ...e,
        selected: false,
        type: e.type ?? "tech",
        data: e.data ?? { style: "solid" as const },
      })) as AppEdge[]

      if (options?.resetHistory) {
        set({
          nodes,
          edges,
          title: doc.title ?? get().title,
          selectedNodeId: null,
          selectedEdgeId: null,
          past: [],
          future: [],
        })
        scheduleSave(get, set)
        return
      }

      commit({
        nodes,
        edges,
        title: doc.title ?? get().title,
        selectedNodeId: null,
        selectedEdgeId: null,
      })
    },

    exportDocument: () => {
      const { nodes, edges, title } = get()
      return {
        version: 1,
        title,
        nodes: nodes.map(({ selected: _sel, dragging: _drag, measured: _m, ...n }) => n as AppNode),
        edges: edges.map(({ selected: _sel, ...e }) => e as AppEdge),
      }
    },

    clearAll: () =>
      commit({ nodes: [], edges: [], selectedNodeId: null, selectedEdgeId: null }),
  }
})
