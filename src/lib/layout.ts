import dagre from "@dagrejs/dagre"
import { nodeSize, rectsIntersect, type Rect } from "./geometry"
import { type AppEdge, type AppNode, type GraphDocument } from "./types"

const GRID = 8
const NODE_GAP = 56
const NODE_CLEARANCE = 48
const COMPONENT_GAP = 96
const TARGET_ASPECT = 1.5
const MAX_PACKED_COMPONENT_SIZE = 32

type LayoutItem = Rect & { id: string }
type WeightedRootEdge = { source: string; target: string; weight: number }
type PlacedItem = LayoutItem & { score?: number }
type ComponentBlock = {
  id: string
  x: number
  y: number
  w: number
  h: number
  items: LayoutItem[]
}

function roundToGrid(value: number): number {
  return Math.round(value / GRID) * GRID
}

function boundsOf(items: Rect[]): Rect {
  const minX = Math.min(...items.map((item) => item.x))
  const minY = Math.min(...items.map((item) => item.y))
  const maxX = Math.max(...items.map((item) => item.x + item.w))
  const maxY = Math.max(...items.map((item) => item.y + item.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function normalize(items: LayoutItem[]): LayoutItem[] {
  const bounds = boundsOf(items)
  return items.map((item) => ({
    ...item,
    x: roundToGrid(item.x - bounds.x),
    y: roundToGrid(item.y - bounds.y),
  }))
}

function centerX(item: Rect): number {
  return item.x + item.w / 2
}

function centerY(item: Rect): number {
  return item.y + item.h / 2
}

function rectangleGap(a: Rect, b: Rect): { x: number; y: number } {
  return {
    x: Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w)),
    y: Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h)),
  }
}

function scoreBounds(items: Rect[], targetAspect = TARGET_ASPECT): number {
  const bounds = boundsOf(items)
  const area = bounds.w * bounds.h
  const aspect = bounds.w / Math.max(1, bounds.h)
  return area * (1 + Math.abs(Math.log(aspect / targetAspect)) * 0.34)
}

function connectedComponents(items: LayoutItem[], edges: WeightedRootEdge[]): LayoutItem[][] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const neighbours = new Map(items.map((item) => [item.id, new Set<string>()]))
  for (const edge of edges) {
    neighbours.get(edge.source)?.add(edge.target)
    neighbours.get(edge.target)?.add(edge.source)
  }

  const seen = new Set<string>()
  const components: LayoutItem[][] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    const component: LayoutItem[] = []
    const queue = [item.id]
    seen.add(item.id)
    while (queue.length > 0) {
      const id = queue.shift()
      if (!id) continue
      const current = byId.get(id)
      if (current) component.push(current)
      for (const neighbour of neighbours.get(id) ?? []) {
        if (seen.has(neighbour)) continue
        seen.add(neighbour)
        queue.push(neighbour)
      }
    }
    components.push(component)
  }
  return components
}

/** Tarjan SCC ids. Directions inside an SCC are preferences, not hard ranks. */
function stronglyConnectedIds(
  items: LayoutItem[],
  edges: WeightedRootEdge[],
): Map<string, number> {
  const outgoing = new Map(items.map((item) => [item.id, [] as string[]]))
  for (const edge of edges) outgoing.get(edge.source)?.push(edge.target)

  let nextIndex = 0
  let nextComponent = 0
  const index = new Map<string, number>()
  const lowLink = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const componentById = new Map<string, number>()

  const visit = (id: string) => {
    index.set(id, nextIndex)
    lowLink.set(id, nextIndex)
    nextIndex += 1
    stack.push(id)
    onStack.add(id)

    for (const target of outgoing.get(id) ?? []) {
      if (!index.has(target)) {
        visit(target)
        lowLink.set(id, Math.min(lowLink.get(id) ?? 0, lowLink.get(target) ?? 0))
      } else if (onStack.has(target)) {
        lowLink.set(id, Math.min(lowLink.get(id) ?? 0, index.get(target) ?? 0))
      }
    }

    if (lowLink.get(id) !== index.get(id)) return
    while (stack.length > 0) {
      const member = stack.pop()
      if (!member) break
      onStack.delete(member)
      componentById.set(member, nextComponent)
      if (member === id) break
    }
    nextComponent += 1
  }

  for (const item of items) {
    if (!index.has(item.id)) visit(item.id)
  }
  return componentById
}

function segmentHitsRect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rect: Rect,
): boolean {
  if (a.x === b.x) {
    if (a.x <= rect.x || a.x >= rect.x + rect.w) return false
    return Math.max(a.y, b.y) > rect.y && Math.min(a.y, b.y) < rect.y + rect.h
  }
  if (a.y === b.y) {
    if (a.y <= rect.y || a.y >= rect.y + rect.h) return false
    return Math.max(a.x, b.x) > rect.x && Math.min(a.x, b.x) < rect.x + rect.w
  }
  return false
}

/** Count cards blocking the shortest simple corridor between two roots. */
function corridorBlocks(a: PlacedItem, b: PlacedItem, obstacles: PlacedItem[]): number {
  const other = obstacles.filter((item) => item.id !== a.id && item.id !== b.id)
  const overlapTop = Math.max(a.y, b.y)
  const overlapBottom = Math.min(a.y + a.h, b.y + b.h)
  if (overlapTop < overlapBottom) {
    const y = (overlapTop + overlapBottom) / 2
    const left = centerX(a) <= centerX(b) ? a : b
    const right = left === a ? b : a
    return other.filter((item) =>
      segmentHitsRect(
        { x: left.x + left.w, y },
        { x: right.x, y },
        item,
      ),
    ).length
  }

  const overlapLeft = Math.max(a.x, b.x)
  const overlapRight = Math.min(a.x + a.w, b.x + b.w)
  if (overlapLeft < overlapRight) {
    const x = (overlapLeft + overlapRight) / 2
    const top = centerY(a) <= centerY(b) ? a : b
    const bottom = top === a ? b : a
    return other.filter((item) =>
      segmentHitsRect(
        { x, y: top.y + top.h },
        { x, y: bottom.y },
        item,
      ),
    ).length
  }

  const firstElbow = { x: centerX(b), y: centerY(a) }
  const secondElbow = { x: centerX(a), y: centerY(b) }
  const first = other.reduce(
    (count, item) =>
      count +
      Number(segmentHitsRect({ x: centerX(a), y: centerY(a) }, firstElbow, item)) +
      Number(segmentHitsRect(firstElbow, { x: centerX(b), y: centerY(b) }, item)),
    0,
  )
  const second = other.reduce(
    (count, item) =>
      count +
      Number(segmentHitsRect({ x: centerX(a), y: centerY(a) }, secondElbow, item)) +
      Number(segmentHitsRect(secondElbow, { x: centerX(b), y: centerY(b) }, item)),
    0,
  )
  return Math.min(first, second)
}

function placementScore(
  placed: PlacedItem[],
  candidate: PlacedItem,
  edges: WeightedRootEdge[],
  sccById: Map<string, number>,
): number {
  const all = [...placed, candidate]
  const byId = new Map(all.map((item) => [item.id, item]))
  let score = scoreBounds(all)

  for (const edge of edges) {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) continue
    const gap = rectangleGap(source, target)
    score += (gap.x + gap.y) * 180 * edge.weight
    if (gap.x > 0 && gap.y > 0) score += Math.min(gap.x, gap.y) * 80 * edge.weight

    // Solid flow edges are the visual backbone. Dashed return/status edges may
    // run backward when that closes a cycle compactly, but at a lower cost.
    if (centerX(target) < centerX(source) - GRID * 2) {
      const crossesSubsystem = sccById.get(source.id) !== sccById.get(target.id)
      score += 110_000 * edge.weight * (crossesSubsystem ? 1.5 : 1)
    }
    score += corridorBlocks(source, target, all) * 100_000 * edge.weight
  }
  return score
}

function placementCoordinates(placed: PlacedItem[], item: LayoutItem): { xs: number[]; ys: number[] } {
  const xs = new Set<number>([0])
  const ys = new Set<number>([0])
  for (const neighbour of placed) {
    xs.add(centerX(neighbour) - item.w / 2)
    xs.add(neighbour.x)
    xs.add(neighbour.x + neighbour.w - item.w)
    xs.add(neighbour.x + neighbour.w + NODE_GAP)
    xs.add(neighbour.x - item.w - NODE_GAP)

    // Grow connected systems from their highest-degree hub downward. Without
    // this bias, equally compact solutions randomly flip the main flow below
    // a secondary frame, which is mathematically valid and visually backwards.
    ys.add(neighbour.y)
    ys.add(neighbour.y + neighbour.h + NODE_GAP)
    ys.add(centerY(neighbour) - item.h / 2)
  }
  return { xs: [...xs], ys: [...ys] }
}

/** Opinionated compact packer for one connected root graph. */
function packGraph(component: LayoutItem[], componentEdges: WeightedRootEdge[]): LayoutItem[] {
  const ids = new Set(component.map((item) => item.id))
  const edges = componentEdges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
  const sccById = stronglyConnectedIds(component, edges)
  const degree = (id: string) =>
    edges.reduce(
      (sum, edge) => sum + (edge.source === id || edge.target === id ? edge.weight : 0),
      0,
    )
  const area = (item: LayoutItem) => item.w * item.h
  let unplaced = [...component].sort(
    (a, b) => degree(b.id) - degree(a.id) || area(b) - area(a) || a.id.localeCompare(b.id),
  )
  const placed: PlacedItem[] = []

  while (unplaced.length > 0) {
    const affinity = (item: LayoutItem) =>
      edges.reduce((sum, edge) => {
        const otherId =
          edge.source === item.id
            ? edge.target
            : edge.target === item.id
              ? edge.source
              : null
        if (!otherId || !placed.some((placedItem) => placedItem.id === otherId)) return sum
        const crossesSubsystem = sccById.get(item.id) !== sccById.get(otherId)
        return sum + edge.weight * (crossesSubsystem ? 5 : 1)
      }, 0)

    if (placed.length > 0) {
      unplaced.sort(
        (a, b) =>
          affinity(b) - affinity(a) ||
          degree(b.id) - degree(a.id) ||
          area(b) - area(a) ||
          a.id.localeCompare(b.id),
      )
    }
    const item = unplaced.shift()
    if (!item) break
    if (placed.length === 0) {
      placed.push({ ...item, x: 0, y: 0 })
      continue
    }

    const { xs, ys } = placementCoordinates(placed, item)
    let best: PlacedItem | null = null
    for (const x of xs) {
      for (const y of ys) {
        const candidate: PlacedItem = { ...item, x, y }
        if (placed.some((other) => rectsIntersect(candidate, other, NODE_CLEARANCE))) continue
        const score = placementScore(placed, candidate, edges, sccById)
        if (!best || score < (best.score ?? Number.POSITIVE_INFINITY)) {
          best = { ...candidate, score }
        }
      }
    }
    const currentBounds = boundsOf(placed)
    placed.push(best ?? { ...item, x: currentBounds.x + currentBounds.w + NODE_GAP, y: 0 })
  }

  return normalize(placed.map(({ score: _score, ...item }) => item))
}

function layoutLargeComponent(
  component: LayoutItem[],
  componentEdges: WeightedRootEdge[],
): LayoutItem[] {
  const ids = new Set(component.map((item) => item.id))
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: "LR",
    nodesep: NODE_GAP,
    ranksep: 104,
    marginx: 0,
    marginy: 0,
    acyclicer: "greedy",
    ranker: "network-simplex",
  })
  g.setDefaultEdgeLabel(() => ({}))
  for (const item of component) g.setNode(item.id, { width: item.w, height: item.h })
  for (const edge of componentEdges) {
    if (ids.has(edge.source) && ids.has(edge.target)) {
      g.setEdge(edge.source, edge.target, { weight: edge.weight })
    }
  }
  dagre.layout(g)
  return normalize(
    component.map((item) => {
      const placed = g.node(item.id)
      return placed
        ? { ...item, x: placed.x - item.w / 2, y: placed.y - item.h / 2 }
        : item
    }),
  )
}

function componentCandidates(placed: ComponentBlock[], block: ComponentBlock) {
  const xs = new Set<number>([0])
  const ys = new Set<number>([0])
  for (const neighbour of placed) {
    xs.add(neighbour.x + neighbour.w / 2 - block.w / 2)
    xs.add(neighbour.x)
    xs.add(neighbour.x + neighbour.w - block.w)
    xs.add(neighbour.x + neighbour.w + COMPONENT_GAP)
    xs.add(neighbour.x - block.w - COMPONENT_GAP)

    // Above is intentionally considered before below. Supporting/tooling
    // islands read naturally above the primary product flow.
    ys.add(neighbour.y - block.h - COMPONENT_GAP)
    ys.add(neighbour.y + neighbour.h + COMPONENT_GAP)
    ys.add(neighbour.y)
    ys.add(neighbour.y + neighbour.h - block.h)
    ys.add(neighbour.y + neighbour.h / 2 - block.h / 2)
  }
  return { xs: [...xs], ys: [...ys] }
}

/** Pack disconnected subsystems around the largest primary graph. */
function packComponents(layouts: LayoutItem[][]): LayoutItem[] {
  const blocks: ComponentBlock[] = layouts
    .map((items, index) => {
      const bounds = boundsOf(items)
      return { id: `component-${index}`, x: 0, y: 0, w: bounds.w, h: bounds.h, items }
    })
    .sort((a, b) => b.w * b.h - a.w * a.h)
  const placed: ComponentBlock[] = []

  for (const block of blocks) {
    if (placed.length === 0) {
      placed.push(block)
      continue
    }
    const { xs, ys } = componentCandidates(placed, block)
    let best: (ComponentBlock & { score: number }) | null = null
    for (const x of xs) {
      for (const y of ys) {
        const candidate = { ...block, x, y }
        if (placed.some((other) => rectsIntersect(candidate, other))) continue
        const score = scoreBounds([...placed, candidate], TARGET_ASPECT)
        if (!best || score < best.score) best = { ...candidate, score }
      }
    }
    const currentBounds = boundsOf(placed)
    placed.push(
      best ?? {
        ...block,
        x: currentBounds.x + currentBounds.w + COMPONENT_GAP,
        y: currentBounds.y,
      },
    )
  }

  const allItems = placed.flatMap((block) =>
    block.items.map((item) => ({ ...item, x: item.x + block.x, y: item.y + block.y })),
  )
  return normalize(allItems)
}

function resetEdgeGeometry(edge: AppEdge): AppEdge {
  const data = edge.data ?? {}
  const {
    labelX: _labelX,
    labelY: _labelY,
    sourcePoint: _sourcePoint,
    targetPoint: _targetPoint,
    ...rest
  } = data
  return { ...edge, data: rest }
}

/**
 * Rebuild the top-level composition from graph topology. Frames stay atomic,
 * strongly connected systems become compact 2D clusters, solid edges lead the
 * reading order, and disconnected subsystems pack around the primary flow.
 */
export function layoutDagre(doc: { nodes: AppNode[]; edges: AppEdge[] }): GraphDocument {
  const byId = new Map(doc.nodes.map((node) => [node.id, node]))
  const rootOf = (id: string): string => {
    let current = byId.get(id)
    const seen = new Set<string>()
    while (current?.parentId && !seen.has(current.id)) {
      seen.add(current.id)
      const parent = byId.get(current.parentId)
      if (!parent) break
      current = parent
    }
    return current?.id ?? id
  }

  const roots = doc.nodes.filter((node) => !node.parentId && !node.hidden)
  if (roots.length === 0) {
    return { version: 1, nodes: doc.nodes, edges: doc.edges.map(resetEdgeGeometry) }
  }
  const items: LayoutItem[] = roots.map((node) => {
    const { w, h } = nodeSize(node)
    return { id: node.id, x: 0, y: 0, w, h }
  })
  const rootIds = new Set(items.map((item) => item.id))

  const weightedByPair = new Map<string, WeightedRootEdge>()
  for (const edge of doc.edges) {
    const source = rootOf(edge.source)
    const target = rootOf(edge.target)
    if (source === target || !rootIds.has(source) || !rootIds.has(target)) continue
    const weight = edge.data?.style === "dashed" ? 1 : 3
    const key = `${source}\u0000${target}`
    const existing = weightedByPair.get(key)
    if (existing) existing.weight += weight
    else weightedByPair.set(key, { source, target, weight })
  }
  const rootEdges = [...weightedByPair.values()]
  const layouts = connectedComponents(items, rootEdges).map((component) =>
    component.length > MAX_PACKED_COMPONENT_SIZE
      ? layoutLargeComponent(component, rootEdges)
      : packGraph(component, rootEdges),
  )
  const arranged = packComponents(layouts)
  const positions = new Map(arranged.map((item) => [item.id, { x: item.x, y: item.y }]))
  const nodes = doc.nodes.map((node) => {
    if (node.parentId || node.hidden) return node
    const position = positions.get(node.id)
    return position ? { ...node, position } : node
  })

  return { version: 1, nodes, edges: doc.edges.map(resetEdgeGeometry) }
}
