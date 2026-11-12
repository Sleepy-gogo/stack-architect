import type { AppNode, GroupNodeData, LegendNodeData, TechNodeData, TextNodeData } from "./types"

/** How a node is referred to across panels (layers list, connections, headers). */
export function nodeLabel(node: AppNode | undefined): string {
  if (!node) return "Unknown"
  if (node.type === "group") return (node.data as GroupNodeData).label || "Frame"
  if (node.type === "text") return (node.data as TextNodeData).text || "Text"
  if (node.type === "legend") return (node.data as LegendNodeData).title || "Legend"
  return (node.data as TechNodeData).name || "Node"
}
