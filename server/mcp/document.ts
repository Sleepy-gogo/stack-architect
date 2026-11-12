import { z } from "zod"
import { layoutDocument } from "../../src/lib/layout.js"
import { MAX_LEGEND_ITEMS } from "../../src/lib/legend.js"
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
      name: z.string().trim().min(1).max(80).describe("Short display name. Wraps to two lines of about 17 characters; longer names are cut off."),
      subtitle: z.string().max(40).describe("A few lowercase words for the role, e.g. \"api routes\" or \"primary store\". Wraps to two lines of about 22 characters. Put detail in note."),
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
const legend = z.object({
  title: z.string().trim().min(1).max(40).optional(),
  items: z.array(z.object({
    label: z.string().trim().min(1).max(40),
    color: color.optional().describe("The colorOverride used by the arrows this entry explains. Omit for the default color of the style."),
    style: z.enum(["solid", "dashed"]).optional(),
  }).strict()).min(1).max(MAX_LEGEND_ITEMS),
}).strict().describe("Explains the arrow colors and styles. Rendered as a legend card beside or under the diagram; prefer this over a text node.")

export const documentSchema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(1).max(120),
  legend: legend.optional(),
  nodes: z.array(node).min(1).max(80),
  edges: z.array(z.object({
    id,
    source: id,
    target: id,
    type: z.literal("tech").optional(),
    data: z.object({
      label: z.string().max(120).optional(),
      style: z.enum(["solid", "dashed"]).optional().describe("Solid for the main flow; dashed for async, callbacks or secondary dependencies. Explain the convention in document.legend. Dashed does not imply uncertainty."),
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

const TEXT_WIDTH = 200
const TEXT_LINE = { sm: 20, md: 26, lg: 28 } as const
const TEXT_CHARS = { sm: 26, md: 22, lg: 16 } as const

/** Text nodes render 200px wide; estimate the height their text wraps to. */
function textSize(text: string, size: "sm" | "md" | "lg" = "md"): { width: number; height: number } {
  const lines = text.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / TEXT_CHARS[size])), 0)
  return { width: TEXT_WIDTH, height: Math.ceil((lines * TEXT_LINE[size] + 8) / 8) * 8 }
}

export async function prepareDocument(input: unknown): Promise<GraphDocument> {
  const parsed = documentSchema.parse(input)
  const nodes: AppNode[] = parsed.nodes.map((entry) => ({
    ...entry,
    position: { x: 0, y: 0 },
    ...(entry.type === "text" ? textSize(entry.data.text, entry.data.size) : {}),
  }))
  if (parsed.legend) {
    const taken = new Set(nodes.map((entry) => entry.id))
    let legendId = "legend"
    for (let suffix = 2; taken.has(legendId); suffix += 1) legendId = `legend-${suffix}`
    nodes.push({ id: legendId, type: "legend", position: { x: 0, y: 0 }, data: { ...parsed.legend } })
  }
  const edges = parsed.edges.map((edge) => ({ ...edge, type: "tech" }))

  const laidOut = await layoutDocument({ nodes, edges })
  // React Flow requires parents to precede their children.
  const ordered: AppNode[] = []
  const append = (parentId?: string) => {
    for (const entry of laidOut.nodes.filter((item) => item.parentId === parentId)) {
      ordered.push(entry)
      append(entry.id)
    }
  }
  append()
  return { version: 1, title: parsed.title, nodes: ordered, edges: laidOut.edges }
}
