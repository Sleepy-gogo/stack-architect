import type { Edge, Node } from "@xyflow/react"

/* ---------- Palette ---------- */

export type TechCategoryId =
  | "generic"
  | "frontend"
  | "backend"
  | "database"
  | "devops"
  | "auth"
  | "language"
  | "tooling"
  | "editors"
  | "monitoring"
  | "design"
  | "payment"
  | "hosting"
  | "crypto"
  | "ai"
  | "media"
  | "social"
  | "gaming"
  | "productivity"
  | "browsers"
  | "software"

export type TechItem = {
  slug: string
  name: string
  subtitle: string
  category: TechCategoryId
  /** extra words matched by the palette search */
  keywords?: string
}

/* ---------- Node data ---------- */

export type TechNodeData = {
  slug: string
  name: string
  subtitle: string
  category: string
  /** override the brand color; falls back to category color */
  colorOverride?: string
  /** dark card variant, like Drizzle / better-auth in the reference */
  dark?: boolean
  /** add a light logo surface when dark brand artwork would lose contrast */
  iconPlate?: boolean
  /** free-form note shown in the inspector, not on the canvas */
  note?: string
  [key: string]: unknown
}

export type GroupNodeData = {
  label: string
  /** accent color for the container border + heading */
  color: string
  /** dashed border style, like Workers Runtime in the reference */
  dashed?: boolean
  /** optional brand icon slug rendered beside the heading */
  icon?: string
  [key: string]: unknown
}

export type TextNodeData = {
  text: string
  color?: string
  /** text scale on the canvas */
  size?: "sm" | "md" | "lg"
  [key: string]: unknown
}

export type AppNodeData = TechNodeData | GroupNodeData | TextNodeData

export type AppNode = Node<AppNodeData>

export const NODE_WIDTH = 148
export const NODE_HEIGHT = 132

/* ---------- Edge data ---------- */

export type EdgeStyle = "solid" | "dashed"

/** Default stroke colors for tech edges, keyed by style. */
export const EDGE_SOLID = "#2563eb"
export const EDGE_DASHED = "#94a3b8"

/** Side length of a tech node's icon card — the visual connection surface. */
export const TECH_CARD_SIZE = 92

export type EdgeEndPoint = { x: number; y: number }

export type TechEdgeData = {
  label?: string
  style?: EdgeStyle
  /** override stroke color; solid edges default to blue, dashed to slate */
  colorOverride?: string
  /**
   * Manually placed label position in flow coordinates. When absent, the
   * label auto-places itself along the edge clear of cards and crossings.
   */
  labelX?: number
  labelY?: number
  /**
   * Pinned tail/head position, normalized (0–1) within the node's connection
   * rect. Absent = automatic: the geometrically best of the four side points,
   * re-evaluated as nodes move.
   */
  sourcePoint?: EdgeEndPoint
  targetPoint?: EdgeEndPoint
  [key: string]: unknown
}

export type AppEdge = Edge<TechEdgeData>

/* ---------- Document / serialization ---------- */

export type GraphDocument = {
  version: number
  title?: string
  nodes: AppNode[]
  edges: AppEdge[]
}

export function isTechNode(node: AppNode): boolean {
  return node.type === "tech"
}

export function isGroupNode(node: AppNode): boolean {
  return node.type === "group"
}

export function isTextNode(node: AppNode): boolean {
  return node.type === "text"
}
