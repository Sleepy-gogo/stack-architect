import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api.js"
import { clearEdgeGeometry } from "./edge-geometry.js"
import { nodeSize } from "./geometry.js"
import { TECH_CARD_SIZE, type AppEdge, type AppNode, type GraphDocument } from "./types.js"

const GRID = 8
/** Room inside a frame: the heading band on top, even padding elsewhere. */
const FRAME_PADDING = { top: 64, left: 32, bottom: 32, right: 32 }
const FRAME_MIN = { w: 240, h: 160 }
/** Notes and legends sit in a row this far below the diagram. */
const ASIDE_GAP = 72
const ASIDE_SPACING = 32

/** ELK doesn't inherit spacing into frames, so every level gets the same set. */
const SPACING: Record<string, string> = {
  // Wide gaps between columns leave room for arrow labels.
  "elk.layered.spacing.nodeNodeBetweenLayers": "120",
  "elk.spacing.nodeNode": "64",
  "elk.spacing.edgeNode": "28",
  "elk.spacing.edgeEdge": "14",
  "elk.layered.spacing.edgeNodeBetweenLayers": "28",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "14",
  "elk.spacing.componentComponent": "96",
}

const ROOT_OPTIONS: Record<string, string> = {
  ...SPACING,
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.edgeRouting": "ORTHOGONAL",
  // Network simplex keeps the most arrows straight in the quality fixtures.
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  // Agents list the main flow first; keep that order where it costs nothing.
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
}

const roundToGrid = (value: number) => Math.round(value / GRID) * GRID
const ceilToGrid = (value: number) => Math.ceil(value / GRID) * GRID

type ElkConstructor = new () => { layout: (graph: ElkNode) => Promise<ElkNode> }
let elkModule: Promise<ElkConstructor> | null = null
function loadElk(): Promise<ElkConstructor> {
  elkModule ??= import("elkjs/lib/elk.bundled.js").then((module) => {
    const exported = module as unknown as { default?: ElkConstructor } & ElkConstructor
    return exported.default ?? exported
  })
  return elkModule
}

/** Notes and legends at the top level don't join the arrow flow. */
const isAside = (node: AppNode) => !node.parentId && (node.type === "text" || node.type === "legend")

/**
 * Lay out the whole document at once, frames and their contents included, so
 * arrows that cross frame boundaries line up too. Frames are resized around
 * their contents; stored arrow geometry is cleared so ports follow the layout.
 */
export async function layoutDocument(
  doc: { nodes: AppNode[]; edges: AppEdge[] },
  /** ELK option overrides, for tuning experiments. */
  overrides: Record<string, string> = {},
): Promise<GraphDocument> {
  const byId = new Map(doc.nodes.map((node) => [node.id, node]))
  const hiddenWithin = (node: AppNode): boolean => {
    let current: AppNode | undefined = node
    const seen = new Set<string>()
    while (current && !seen.has(current.id)) {
      if (current.hidden) return true
      seen.add(current.id)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    return false
  }
  const included = doc.nodes.filter((node) => !hiddenWithin(node) && !isAside(node))
  const includedIds = new Set(included.map((node) => node.id))
  if (included.length === 0) return { version: 1, nodes: placeAsides(doc.nodes, []), edges: clearEdgeGeometry(doc.edges) }

  const chain = (id: string): string[] => {
    const ids: string[] = []
    let current = byId.get(id)
    const seen = new Set<string>()
    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      ids.push(current.id)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    return ids
  }

  const elkNodes = new Map<string, ElkNode>()
  for (const node of included) {
    const elkNode: ElkNode = { id: node.id }
    if (node.type === "group") {
      elkNode.layoutOptions = {
        ...SPACING,
        "elk.padding": `[top=${FRAME_PADDING.top},left=${FRAME_PADDING.left},bottom=${FRAME_PADDING.bottom},right=${FRAME_PADDING.right}]`,
        "elk.nodeSize.constraints": "MINIMUM_SIZE",
        "elk.nodeSize.minimum": `(${FRAME_MIN.w}, ${FRAME_MIN.h})`,
      }
      elkNode.children = []
      elkNode.edges = []
    } else {
      const { w, h } = nodeSize(node)
      elkNode.width = w
      elkNode.height = h
      if (node.type === "tech") {
        // Arrows attach to the icon card, not the middle of the card-plus-label
        // box. One fixed port per side at the card's center lets ELK line up
        // the cards themselves.
        const middle = TECH_CARD_SIZE / 2
        elkNode.layoutOptions = { "elk.portConstraints": "FIXED_POS" }
        elkNode.ports = [
          { id: `${node.id}::in`, x: 0, y: middle, width: 0, height: 0, layoutOptions: { "elk.port.side": "WEST" } },
          { id: `${node.id}::out`, x: w, y: middle, width: 0, height: 0, layoutOptions: { "elk.port.side": "EAST" } },
        ]
      }
    }
    elkNodes.set(node.id, elkNode)
  }
  const root: ElkNode = { id: "__root__", layoutOptions: { ...ROOT_OPTIONS, ...overrides }, children: [], edges: [] }
  for (const node of included) {
    const parent = node.parentId && includedIds.has(node.parentId) ? elkNodes.get(node.parentId)! : root
    parent.children!.push(elkNodes.get(node.id)!)
  }

  // A dashed reply to a solid call (a webhook, a status callback) shouldn't
  // pull its caller around; the solid call already places both ends.
  const solidPairs = new Set(doc.edges.filter((edge) => edge.data?.style !== "dashed").map((edge) => `${edge.source}\u0000${edge.target}`))
  for (const edge of doc.edges) {
    if (edge.data?.style === "dashed" && solidPairs.has(`${edge.target}\u0000${edge.source}`)) continue
    if (edge.hidden || !includedIds.has(edge.source) || !includedIds.has(edge.target) || edge.source === edge.target) continue
    const sourceChain = chain(edge.source)
    const targetChain = chain(edge.target)
    // A node and the frame around it are already related by containment.
    if (sourceChain.includes(edge.target) || targetChain.includes(edge.source)) continue
    const shared = sourceChain.find((id) => id !== edge.source && targetChain.includes(id))
    const container = shared && elkNodes.get(shared) ? elkNodes.get(shared)! : root
    const dashed = edge.data?.style === "dashed"
    const elkEdge: ElkExtendedEdge = {
      id: edge.id,
      sources: [byId.get(edge.source)?.type === "tech" ? `${edge.source}::out` : edge.source],
      targets: [byId.get(edge.target)?.type === "tech" ? `${edge.target}::in` : edge.target],
      layoutOptions: {
        // Solid arrows are the story: they keep their direction and run straight first.
        "elk.layered.priority.direction": dashed ? "0" : "10",
        "elk.layered.priority.straightness": dashed ? "1" : "10",
      },
    }
    container.edges!.push(elkEdge)
  }

  const Elk = await loadElk()
  const result = await new Elk().layout(root)

  const placed = new Map<string, { x: number; y: number; w?: number; h?: number }>()
  const visit = (elkNode: ElkNode) => {
    for (const child of elkNode.children ?? []) {
      const node = byId.get(child.id)
      placed.set(child.id, {
        x: roundToGrid(child.x ?? 0),
        y: roundToGrid(child.y ?? 0),
        ...(node?.type === "group" ? { w: ceilToGrid(child.width ?? FRAME_MIN.w), h: ceilToGrid(child.height ?? FRAME_MIN.h) } : {}),
      })
      visit(child)
    }
  }
  visit(result)

  const laidOut = doc.nodes.map((node) => {
    const position = placed.get(node.id)
    if (!position) return node
    const next: AppNode = { ...node, position: { x: position.x, y: position.y } }
    if (position.w !== undefined && position.h !== undefined) {
      next.width = position.w
      next.height = position.h
      next.style = { ...node.style, width: position.w, height: position.h }
    }
    return next
  })
  const mainRoots = laidOut.filter((node) => !node.parentId && placed.has(node.id))
  return { version: 1, nodes: placeAsides(laidOut, mainRoots), edges: clearEdgeGeometry(doc.edges) }
}

/** Line top-level notes and legends up under the diagram, legend first. */
function placeAsides(nodes: AppNode[], mainRoots: AppNode[]): AppNode[] {
  const asides = nodes.filter((node) => isAside(node) && !node.hidden)
    .sort((a, b) => Number(b.type === "legend") - Number(a.type === "legend"))
  if (asides.length === 0) return nodes
  const left = mainRoots.length ? Math.min(...mainRoots.map((node) => node.position.x)) : 0
  const bottom = mainRoots.length ? Math.max(...mainRoots.map((node) => node.position.y + nodeSize(node).h)) : 0
  let x = left
  const y = mainRoots.length ? ceilToGrid(bottom + ASIDE_GAP) : 0
  const positions = new Map<string, { x: number; y: number }>()
  for (const node of asides) {
    positions.set(node.id, { x, y })
    x = ceilToGrid(x + nodeSize(node).w + ASIDE_SPACING)
  }
  return nodes.map((node) => {
    const position = positions.get(node.id)
    return position ? { ...node, position } : node
  })
}
