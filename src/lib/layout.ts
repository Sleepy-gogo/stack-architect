import type { ElkExtendedEdge, ElkNode } from "elkjs/lib/elk-api.js"
import { clearEdgeGeometry } from "./edge-geometry.js"
import { measureRoutes, routeEdges } from "./edge-routing.js"
import { absoluteRect, nodeSize } from "./geometry.js"
import { cardHeight, frameHeadingWidth } from "./label-text.js"
import { TECH_CARD_SIZE, type AppEdge, type AppNode, type GraphDocument } from "./types.js"

const GRID = 8
/** Room inside a frame: the heading band on top, even padding elsewhere. */
const FRAME_PADDING = { top: 64, left: 32, bottom: 32, right: 32 }
const FRAME_MIN = { w: 240, h: 160 }
/** Frames without arrows lay their contents out in rows of at most this many. */
const PACK_MAX_COLUMNS = 4
const PACK_GAP = { x: 48, y: 40 }
/** Reference frames and notes sit in rows this far below the arrow flow. */
const STRIP_GAP = 96
const STRIP_SPACING = 64
/** A strip row may grow at least this wide before it wraps. */
const STRIP_MIN_WIDTH = 960
const LEGEND_GAP = 72
/** Wider than this, a legend goes under the diagram instead of beside it. */
const TARGET_ASPECT = 16 / 9

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

/** A card's footprint includes its wrapped name and subtitle. */
function layoutSize(node: AppNode): { w: number; h: number } {
  const size = nodeSize(node)
  if (node.type !== "tech") return size
  return { w: size.w, h: Math.max(size.h, cardHeight(node.data as { name?: unknown; subtitle?: unknown })) }
}

const frameMinWidth = (node: AppNode) =>
  Math.max(FRAME_MIN.w, frameHeadingWidth((node.data as { label?: unknown }).label))

type Box = { x: number; y: number; w: number; h: number }
type Placement = { x: number; y: number; w?: number; h?: number }

/**
 * Which children of a frame are laid out in rows: only those without any
 * arrow, or every child without an arrow to a sibling. The second packs
 * reference frames tighter but can pull a card away from its partners.
 */
type RowMode = "edgeless" | "unconnected"

/** The view the layout aims to fill, roughly a laptop canvas. */
const VIEW = { w: 1600, h: 900 }

/** Lower is better: crossings and detours first, then how small a full view gets. */
function score(doc: GraphDocument): number {
  const quality = measureRoutes(routeEdges(doc.nodes, doc.edges), doc.nodes)
  const byId = new Map(doc.nodes.map((node) => [node.id, node]))
  const rects = doc.nodes.filter((node) => !node.hidden).map((node) => absoluteRect(node, byId))
  const w = Math.max(...rects.map((rect) => rect.x + rect.w)) - Math.min(...rects.map((rect) => rect.x))
  const h = Math.max(...rects.map((rect) => rect.y + rect.h)) - Math.min(...rects.map((rect) => rect.y))
  const fitZoom = Math.min(1, VIEW.w / w, VIEW.h / h)
  return quality.crossings * 40 + quality.throughLabels * 40 + quality.jogs * 20 + quality.bends * 4 +
    quality.sharedLane * 0.5 - quality.straight * 6 - fitZoom * 400
}

/**
 * Lay out the document in two parts. Everything joined by arrows goes through
 * ELK at once, frames and their contents included, so arrows that cross frame
 * boundaries line up too. Frames no arrow touches, such as shared packages or
 * tooling, are packed into rows and placed in a strip under that flow with
 * any notes, so they don't stretch it into a tall column. Frames are resized
 * around their contents; stored arrow geometry is cleared so ports follow.
 *
 * When frames hold children that don't connect to each other, both row modes
 * are tried and the one that routes better and reads larger wins.
 */
export async function layoutDocument(
  doc: { nodes: AppNode[]; edges: AppEdge[] },
  /** ELK option overrides, for tuning experiments. */
  overrides: Record<string, string> = {},
): Promise<GraphDocument> {
  const edgeless = await arrange(doc, overrides, "edgeless")
  const unconnected = await arrange(doc, overrides, "unconnected")
  if (edgeless.rows === unconnected.rows) return edgeless.doc
  return score(unconnected.doc) < score(edgeless.doc) ? unconnected.doc : edgeless.doc
}

async function arrange(
  doc: { nodes: AppNode[]; edges: AppEdge[] },
  overrides: Record<string, string>,
  mode: RowMode,
): Promise<{ doc: GraphDocument; rows: string }> {
  const rows: string[] = []
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
  const included = doc.nodes.filter((node) => !hiddenWithin(node))
  const includedIds = new Set(included.map((node) => node.id))
  const parentOf = (node: AppNode) => (node.parentId && includedIds.has(node.parentId) ? node.parentId : undefined)
  const childrenOf = new Map<string, AppNode[]>()
  for (const node of included) {
    const parentId = parentOf(node)
    if (!parentId) continue
    const siblings = childrenOf.get(parentId) ?? []
    siblings.push(node)
    childrenOf.set(parentId, siblings)
  }

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

  const edges = doc.edges.filter((edge) =>
    !edge.hidden && includedIds.has(edge.source) && includedIds.has(edge.target) && edge.source !== edge.target)
  // A node is linked when an arrow touches it or anything inside it.
  const linked = new Set<string>()
  for (const edge of edges) for (const id of [...chain(edge.source), ...chain(edge.target)]) linked.add(id)

  const placed = new Map<string, Placement>()

  /** Rows of children inside a frame no arrow touches, recursively. */
  const pack = (group: AppNode): { w: number; h: number } => {
    const kids = childrenOf.get(group.id) ?? []
    const sizes = kids.map((kid) => (kid.type === "group" ? pack(kid) : layoutSize(kid)))
    const columns = kids.length <= PACK_MAX_COLUMNS
      ? kids.length
      : Math.min(PACK_MAX_COLUMNS, Math.ceil(Math.sqrt(kids.length * 1.5)))
    let y = FRAME_PADDING.top
    let contentW = 0
    for (let start = 0; start < kids.length; start += columns) {
      let x = FRAME_PADDING.left
      let rowH = 0
      for (let index = start; index < Math.min(kids.length, start + columns); index += 1) {
        const prior = placed.get(kids[index].id)
        placed.set(kids[index].id, { ...prior, x: roundToGrid(x), y: roundToGrid(y) })
        x += sizes[index].w + PACK_GAP.x
        rowH = Math.max(rowH, sizes[index].h)
      }
      contentW = Math.max(contentW, x - PACK_GAP.x - FRAME_PADDING.left)
      y += rowH + PACK_GAP.y
    }
    const contentH = kids.length ? y - PACK_GAP.y - FRAME_PADDING.top : 0
    const size = {
      w: ceilToGrid(Math.max(frameMinWidth(group), FRAME_PADDING.left + contentW + FRAME_PADDING.right)),
      h: ceilToGrid(Math.max(FRAME_MIN.h, FRAME_PADDING.top + contentH + FRAME_PADDING.bottom)),
    }
    placed.set(group.id, { ...placed.get(group.id), x: 0, y: 0, ...size })
    return size
  }

  // ELK takes the linked part. A frame inside it that no arrow touches is
  // packed first and handed to ELK as a fixed box.
  const elkNodes = new Map<string, ElkNode>()
  const packedSizes = new Map<string, { w: number; h: number }>()
  const addToElk = (node: AppNode, parent: ElkNode) => {
    let elkNode: ElkNode
    if (node.type === "group" && !linked.has(node.id)) {
      const size = pack(node)
      packedSizes.set(node.id, size)
      elkNode = { id: node.id, width: size.w, height: size.h }
    } else if (node.type === "group") {
      elkNode = {
        id: node.id,
        layoutOptions: {
          ...SPACING,
          "elk.padding": `[top=${FRAME_PADDING.top},left=${FRAME_PADDING.left},bottom=${FRAME_PADDING.bottom},right=${FRAME_PADDING.right}]`,
          "elk.nodeSize.constraints": "MINIMUM_SIZE",
          "elk.nodeSize.minimum": `(${frameMinWidth(node)}, ${FRAME_MIN.h})`,
        },
        children: [],
        edges: [],
      }
    } else {
      const { w, h } = layoutSize(node)
      elkNode = { id: node.id, width: w, height: h }
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
    parent.children!.push(elkNode)
    if (elkNode.children) for (const kid of childrenOf.get(node.id) ?? []) addToElk(kid, elkNode)
  }

  const roots = included.filter((node) => !parentOf(node))
  const mainRoots = roots.filter((node) => linked.has(node.id))
  const stripRoots = [
    ...roots.filter((node) => !linked.has(node.id) && !isAside(node)),
    ...roots.filter((node) => isAside(node) && node.type !== "legend"),
  ]
  const legends = roots.filter((node) => node.type === "legend" && !linked.has(node.id))

  if (mainRoots.length) {
    const root: ElkNode = { id: "__root__", layoutOptions: { ...ROOT_OPTIONS, ...overrides }, children: [], edges: [] }
    for (const node of mainRoots) addToElk(node, root)

    // A dashed reply to a solid call (a webhook, a status callback) shouldn't
    // pull its caller around; the solid call already places both ends.
    const solidPairs = new Set(edges.filter((edge) => edge.data?.style !== "dashed").map((edge) => `${edge.source}\u0000${edge.target}`))
    for (const edge of edges) {
      if (edge.data?.style === "dashed" && solidPairs.has(`${edge.target}\u0000${edge.source}`)) continue
      if (!elkNodes.has(edge.source) || !elkNodes.has(edge.target)) continue
      const sourceChain = chain(edge.source)
      const targetChain = chain(edge.target)
      // A node and the frame around it are already related by containment.
      if (sourceChain.includes(edge.target) || targetChain.includes(edge.source)) continue
      const shared = sourceChain.find((id) => id !== edge.source && targetChain.includes(id))
      const container = shared && elkNodes.get(shared)?.edges ? elkNodes.get(shared)! : root
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

    // ELK puts a frame's children that don't connect to each other in one
    // layer, which stacks them into a tall column. Chain them with invisible
    // edges instead, in rows like a packed frame, in the order they were given.
    const nextToSibling = new Set<string>()
    for (const edge of edges) {
      const sourceChain = chain(edge.source)
      const targetChain = chain(edge.target)
      const common = sourceChain.find((id) => targetChain.includes(id))
      const sourceRep = sourceChain[(common ? sourceChain.indexOf(common) : sourceChain.length) - 1]
      const targetRep = targetChain[(common ? targetChain.indexOf(common) : targetChain.length) - 1]
      if (sourceRep && targetRep) {
        nextToSibling.add(sourceRep)
        nextToSibling.add(targetRep)
      }
    }
    const inRows = (id: string) => (mode === "edgeless" ? !linked.has(id) : !nextToSibling.has(id))
    const port = (id: string, side: "in" | "out") => (byId.get(id)?.type === "tech" ? `${id}::${side}` : id)
    for (const [groupId, elkGroup] of elkNodes) {
      if (!elkGroup.edges) continue
      // In a left-to-right flow, cards that receive arrows lead the row and
      // cards that send them close it, so no arrow jumps over its neighbors.
      const flow = (id: string) => edges.reduce((sum, edge) => {
        const out = chain(edge.source).includes(id)
        const into = chain(edge.target).includes(id)
        return out === into ? sum : sum + (out ? 1 : -1)
      }, 0)
      const loose = (childrenOf.get(groupId) ?? [])
        .filter((kid) => elkNodes.has(kid.id) && inRows(kid.id))
        .map((kid, index) => ({ kid, index, flow: Math.sign(flow(kid.id)) }))
        .sort((a, b) => a.flow - b.flow || a.index - b.index)
        .map((entry) => entry.kid)
      if (loose.length >= 2) rows.push(loose.map((kid) => kid.id).join(","))
      if (loose.length < 2) continue
      const columns = loose.length <= PACK_MAX_COLUMNS
        ? loose.length
        : Math.min(PACK_MAX_COLUMNS, Math.ceil(Math.sqrt(loose.length * 1.5)))
      for (let index = 1; index < loose.length; index += 1) {
        if (index % columns === 0) continue
        elkGroup.edges.push({
          id: `__row__${loose[index - 1].id}__${loose[index].id}`,
          sources: [port(loose[index - 1].id, "out")],
          targets: [port(loose[index].id, "in")],
          layoutOptions: { "elk.layered.priority.direction": "1", "elk.layered.priority.straightness": "5" },
        })
      }
    }

    const Elk = await loadElk()
    const result = await new Elk().layout(root)
    const visit = (elkNode: ElkNode) => {
      for (const child of elkNode.children ?? []) {
        const node = byId.get(child.id)
        const packed = packedSizes.get(child.id)
        placed.set(child.id, {
          x: roundToGrid(child.x ?? 0),
          y: roundToGrid(child.y ?? 0),
          ...(packed ?? (node?.type === "group"
            ? { w: ceilToGrid(child.width ?? FRAME_MIN.w), h: ceilToGrid(child.height ?? FRAME_MIN.h) }
            : {})),
        })
        visit(child)
      }
    }
    visit(result)
  }

  const sizeOf = (node: AppNode) => {
    const position = placed.get(node.id)
    return position?.w !== undefined && position.h !== undefined ? { w: position.w, h: position.h } : layoutSize(node)
  }
  const bounds = (nodes: AppNode[]): Box | null => {
    if (!nodes.length) return null
    const boxes = nodes.map((node) => ({ ...placed.get(node.id)!, ...sizeOf(node) }))
    const x = Math.min(...boxes.map((box) => box.x))
    const y = Math.min(...boxes.map((box) => box.y))
    return {
      x,
      y,
      w: Math.max(...boxes.map((box) => box.x + box.w)) - x,
      h: Math.max(...boxes.map((box) => box.y + box.h)) - y,
    }
  }

  // The strip: unlinked frames, loose cards and notes, in rows under the flow.
  const main = bounds(mainRoots)
  const left = main?.x ?? 0
  const rowWidth = Math.max(main?.w ?? 0, STRIP_MIN_WIDTH)
  let x = left
  let y = main ? ceilToGrid(main.y + main.h + STRIP_GAP) : 0
  let rowH = 0
  for (const node of stripRoots) {
    const size = node.type === "group" ? pack(node) : layoutSize(node)
    if (x > left && x + size.w > left + rowWidth) {
      x = left
      y = ceilToGrid(y + rowH + STRIP_SPACING)
      rowH = 0
    }
    placed.set(node.id, { ...placed.get(node.id), x, y })
    x = ceilToGrid(x + size.w + STRIP_SPACING)
    rowH = Math.max(rowH, size.h)
  }

  // Legends go beside a tall diagram and under a wide one, at the right edge
  // either way: the editor's layer list covers the bottom-left corner.
  const whole = bounds([...mainRoots, ...stripRoots])
  let offset = 0
  for (const node of legends) {
    const size = layoutSize(node)
    if (!whole) placed.set(node.id, { x: offset, y: 0 })
    else if (whole.w / whole.h < TARGET_ASPECT) placed.set(node.id, { x: ceilToGrid(whole.x + whole.w + LEGEND_GAP), y: whole.y + offset })
    else placed.set(node.id, { x: roundToGrid(whole.x + whole.w - size.w - offset), y: ceilToGrid(whole.y + whole.h + LEGEND_GAP) })
    offset += (whole && whole.w / whole.h < TARGET_ASPECT ? size.h : size.w) + STRIP_SPACING / 2
  }

  const nodes = doc.nodes.map((node) => {
    const position = placed.get(node.id)
    if (!position) return node
    const next: AppNode = { ...node, position: { x: position.x, y: position.y } }
    if (node.type === "group" && position.w !== undefined && position.h !== undefined) {
      next.width = position.w
      next.height = position.h
      next.style = { ...node.style, width: position.w, height: position.h }
    }
    return next
  })
  return { doc: { version: 1, nodes, edges: clearEdgeGeometry(doc.edges) }, rows: rows.join(";") }
}
