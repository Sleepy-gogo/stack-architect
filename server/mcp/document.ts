import { z } from "zod"
import { layoutDagre } from "../../src/lib/layout.js"
import { nodeSize } from "../../src/lib/geometry.js"
import { layoutEdgeAnchors } from "../../src/lib/layout-anchors.js"
import { categories, techCatalog } from "../../src/lib/catalog.js"
import type { AppNode, GraphDocument } from "../../src/lib/types.js"

export const MAX_MCP_BODY_BYTES = 128_000
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/u)
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/u)
const position = z.object({ x: z.number().finite(), y: z.number().finite() }).strict()
const catalogSlugs = new Set(techCatalog.map((item) => item.slug))
const iconSlug = z.string().regex(/^[a-z0-9-]{1,64}$/u)
  .refine((slug) => catalogSlugs.has(slug), "Unknown icon slug. Use search_architecture_icons to find an exact slug or a generic building block.")
const common = {
  id,
  parentId: id.optional(),
  position: position.optional(),
}
const node = z.discriminatedUnion("type", [
  z.object({
    ...common,
    type: z.literal("tech"),
    data: z.object({
      slug: iconSlug.describe("Exact slug from search_architecture_icons. Prefer the actual brand, e.g. astro, sentry, mercadopago."),
      name: z.string().trim().min(1).max(80),
      subtitle: z.string().max(160),
      category: z.enum(categories.map((entry) => entry.id)),
      note: z.string().max(2000).optional(),
      colorOverride: color.optional(),
      dark: z.boolean().optional(),
      iconPlate: z.boolean().optional(),
    }).strict(),
  }).strict(),
  z.object({
    ...common,
    type: z.literal("group"),
    data: z.object({
      label: z.string().trim().min(1).max(80),
      color: color.describe("Frame accent for its border and heading, not a background fill. Use a medium tone such as #8b5cf6, #0d9488 or #64748b; the renderer supplies a faint tint and adjusts contrast for the theme. Avoid pale fills such as #ddd6fe or #f1f5f9."),
      dashed: z.boolean().optional(),
      icon: iconSlug.optional().describe("Catalog icon for the frame heading, e.g. vercel or docker."),
    }).strict(),
  }).strict(),
  z.object({
    ...common,
    type: z.literal("text"),
    data: z.object({
      text: z.string().trim().min(1).max(500),
      color: color.optional(),
      size: z.enum(["sm", "md", "lg"]).optional(),
    }).strict(),
  }).strict(),
])

// A bounded GraphDocument input profile, not another diagram format. Positions
// and dimensions are calculated on the server; arbitrary React Flow props aren't accepted.
// Legacy positions are accepted for compatibility but are not layout constraints.
export const documentSchema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(1).max(120),
  nodes: z.array(node).min(1).max(80),
  edges: z.array(z.object({
    id,
    source: id,
    target: id,
    type: z.literal("tech").optional(),
    data: z.object({
      label: z.string().max(120).optional(),
      style: z.enum(["solid", "dashed"]).optional().describe("Solid for the main flow; dashed for async, callbacks or secondary dependencies. Explain the convention in a text legend. Dashed does not imply uncertainty."),
      colorOverride: color.optional().describe("Arrow and label color, e.g. #8b5cf6 for client traffic. Use a small consistent palette by relationship type."),
    }).strict().optional(),
  }).strict()).max(160),
}).strict().superRefine((document, context) => {
  const nodes = new Map(document.nodes.map((entry) => [entry.id, entry]))
  const reject = (message: string) => context.addIssue({ code: "custom", message })
  if (nodes.size !== document.nodes.length) reject("Node IDs must be unique.")
  if (new Set(document.edges.map((entry) => entry.id)).size !== document.edges.length) reject("Edge IDs must be unique.")
  for (const entry of document.nodes) {
    const seen = new Set([entry.id])
    let parentId = entry.parentId
    while (parentId) {
      const parent = nodes.get(parentId)
      if (!parent || parent.type !== "group") { reject(`Invalid parent for ${entry.id}.`); break }
      if (seen.has(parentId)) { reject("Group hierarchy contains a cycle."); break }
      seen.add(parentId)
      if (seen.size > 5) { reject("Groups may be nested at most four levels."); break }
      parentId = parent.parentId
    }
  }
  for (const edge of document.edges) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) reject(`Unknown endpoint in ${edge.id}.`)
    if (edge.source === edge.target) reject(`Self connections are not supported: ${edge.id}.`)
  }
})

export function prepareDocument(input: unknown): GraphDocument {
  const parsed = documentSchema.parse(input)
  const nodes: AppNode[] = parsed.nodes.map((entry) => ({
    ...entry,
    position: { x: 0, y: 0 },
    ...(entry.type === "text" ? { width: 320, height: 180 } : {}),
  }))
  const edges = parsed.edges.map((edge) => ({ ...edge, type: "tech" }))
  const byId = new Map(nodes.map((entry) => [entry.id, entry]))

  // Lay out children before their containing frame. The editor's layout treats
  // frames as atomic, so invoking it only once would stack all children at (0, 0).
  const arrange = (parentId?: string): AppNode[] => {
    const children = nodes.filter((entry) => entry.parentId === parentId)
    for (const child of children) {
      if (child.type !== "group") continue
      const contents = arrange(child.id)
      child.width = Math.max(240, ...contents.map((entry) => entry.position.x + nodeSize(entry).w + 32))
      child.height = Math.max(160, ...contents.map((entry) => entry.position.y + nodeSize(entry).h + 32))
      child.style = { width: child.width, height: child.height }
    }
    const ids = new Set(children.map((entry) => entry.id))
    const root = (key: string): string => {
      let entry = byId.get(key)
      while (entry?.parentId && !ids.has(entry.id)) entry = byId.get(entry.parentId)
      return entry?.id ?? key
    }
    const local = layoutDagre({
      nodes: children.map((entry) => ({ ...entry, parentId: undefined })),
      edges: edges.map((edge) => ({ ...edge, source: root(edge.source), target: root(edge.target) })),
    })
    for (const placed of local.nodes) {
      const original = byId.get(placed.id)!
      original.position = { x: placed.position.x + (parentId ? 32 : 0), y: placed.position.y + (parentId ? 64 : 0) }
    }
    return children
  }
  arrange()
  // React Flow requires parents to precede their children.
  const ordered: AppNode[] = []
  const append = (parentId?: string) => {
    for (const entry of nodes.filter((item) => item.parentId === parentId)) {
      ordered.push(entry)
      append(entry.id)
    }
  }
  append()
  return { version: 1, title: parsed.title, nodes: ordered, edges: layoutEdgeAnchors(ordered, edges) }
}
