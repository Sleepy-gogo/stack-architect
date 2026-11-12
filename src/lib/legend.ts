import { EDGE_DASHED, EDGE_SOLID, type AppEdge, type LegendItem, type LegendNodeData } from "./types.js"

export const LEGEND_WIDTH = 220
const LEGEND_PADDING = 14
const LEGEND_TITLE = 22
const LEGEND_ROW = 22
export const MAX_LEGEND_ITEMS = 8

/** Fixed footprint so layout knows the legend's size before it renders. */
export function legendSize(data: Partial<LegendNodeData> | undefined): { w: number; h: number } {
  const rows = Math.max(1, data?.items?.length ?? 0)
  return { w: LEGEND_WIDTH, h: LEGEND_PADDING * 2 + (data?.title ? LEGEND_TITLE : 0) + rows * LEGEND_ROW }
}

export function legendColor(item: LegendItem): string {
  return item.color ?? (item.style === "dashed" ? EDGE_DASHED : EDGE_SOLID)
}

/**
 * One entry per distinct line color and style on the canvas, labelled with the
 * arrows' most common label so the user only has to adjust the wording.
 */
export function legendItemsFromEdges(edges: AppEdge[]): LegendItem[] {
  const groups = new Map<string, { color: string; style: "solid" | "dashed"; labels: Map<string, number>; count: number }>()
  for (const edge of edges) {
    if (edge.hidden) continue
    const style = edge.data?.style === "dashed" ? "dashed" : "solid"
    const color = (edge.data?.colorOverride ?? (style === "dashed" ? EDGE_DASHED : EDGE_SOLID)).toLowerCase()
    const key = `${color}\u0000${style}`
    const group = groups.get(key) ?? { color, style, labels: new Map(), count: 0 }
    group.count += 1
    const label = edge.data?.label?.trim()
    if (label) group.labels.set(label, (group.labels.get(label) ?? 0) + 1)
    groups.set(key, group)
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || Number(a.style === "dashed") - Number(b.style === "dashed"))
    .slice(0, MAX_LEGEND_ITEMS)
    .map((group) => {
      const [common] = [...group.labels.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      return {
        label: common?.[0] ?? (group.style === "dashed" ? "Asynchronous" : "Request"),
        color: group.color,
        style: group.style,
      }
    })
}
