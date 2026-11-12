import { documentSchema } from "./document.js"
import { EDGE_DASHED, EDGE_SOLID } from "../../src/lib/types.js"
import { clippedLabels, NAME_CHARS_PER_LINE, SUBTITLE_CHARS_PER_LINE } from "../../src/lib/label-text.js"

/** More arrow colors than this stop reading as a system. */
const MAX_ARROW_COLORS = 4

type Finding = {
  code: "crowded-node" | "busy-boundary" | "dense-overview" | "pale-frame-accent" | "many-arrow-colors" | "missing-legend" | "clipped-label"
  nodeIds: string[]
  edgeIds: string[]
  message: string
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Structural review only. Never infer architecture, delete edges, or save a project. */
export function reviewDocument(input: unknown) {
  const document = documentSchema.parse(input)
  const findings: Finding[] = []
  const incident = new Map(document.nodes.map((node) => [node.id, [] as string[]]))
  for (const edge of document.edges) {
    incident.get(edge.source)!.push(edge.id)
    incident.get(edge.target)!.push(edge.id)
  }
  const byId = new Map(document.nodes.map((node) => [node.id, node]))
  const inside = (id: string, groupId: string): boolean => {
    let current = byId.get(id)
    while (current) {
      if (current.id === groupId) return true
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
    return false
  }
  const techNodes = document.nodes.filter((node) => node.type === "tech")
  for (const node of document.nodes) {
    const edgeIds = incident.get(node.id)!
    if (node.type === "tech" && edgeIds.length >= 6) {
      findings.push({ code: "crowded-node", nodeIds: [node.id], edgeIds,
        message: `${node.data.name} has ${edgeIds.length} connections. Review at six; usually restructure at eight or more. Split a broad role into repository-supported responsibilities inside its runtime frame, summarize subsystem relationships at the frame boundary, or move secondary dependencies to notes. Wrapping the same hub in an empty frame does not reduce traffic. Keep essential distinct flows.` })
    }
    if (node.type !== "group") continue
    const external = document.edges.filter((edge) => inside(edge.source, node.id) !== inside(edge.target, node.id))
    if (external.length >= 8) {
      findings.push({ code: "busy-boundary", nodeIds: [node.id], edgeIds: external.map((edge) => edge.id),
        message: `${node.data.label} has ${external.length} connections crossing its boundary. Keep local relationships inside the frame. Consolidate only relationships with the same purpose and counterpart; move shared-code imports and telemetry out of the runtime overview when they are not its subject.` })
    }
    if (luminance(node.data.color) > 0.7) {
      findings.push({ code: "pale-frame-accent", nodeIds: [node.id], edgeIds: [],
        message: `${node.data.label} uses ${node.data.color}, a pale fill-like color. Frame color is a border/heading accent; prefer a medium tone such as #8b5cf6, #0d9488 or #64748b. The renderer supplies the tint and adapts contrast.` })
    }
  }
  if (techNodes.length >= 8 && document.edges.length > techNodes.length * 1.5) {
    findings.push({ code: "dense-overview", nodeIds: [], edgeIds: [],
      message: `${document.edges.length} arrows for ${techNodes.length} component nodes is a density warning, not a validity error. Choose one main story. Remove redundant import arrows, keep important callbacks, and put supporting details in notes or a separate detail view when requested.` })
  }
  const colorOf = (edge: (typeof document.edges)[number]) =>
    (edge.data?.colorOverride ?? (edge.data?.style === "dashed" ? EDGE_DASHED : EDGE_SOLID)).toLowerCase()
  const byColor = new Map<string, string[]>()
  for (const edge of document.edges) byColor.set(colorOf(edge), [...(byColor.get(colorOf(edge)) ?? []), edge.id])
  if (byColor.size > MAX_ARROW_COLORS) {
    findings.push({ code: "many-arrow-colors", nodeIds: [], edgeIds: document.edges.map((edge) => edge.id),
      message: `Arrows use ${byColor.size} colors. Readers can hold about ${MAX_ARROW_COLORS}. Give each color one relationship family, such as requests, persistence, callbacks or tooling, and reuse it. Labels and dashes carry the rest.` })
  }
  const styles = new Set(document.edges.map((edge) => `${colorOf(edge)}:${edge.data?.style ?? "solid"}`))
  if (!document.legend && styles.size >= 2) {
    findings.push({ code: "missing-legend", nodeIds: [], edgeIds: [],
      message: `Arrows use ${styles.size} color and line-style combinations without document.legend. Add a legend entry for each, with the same color and style, so readers don't have to guess what they mean.` })
  }
  const clipped = techNodes.flatMap((node) => clippedLabels(node.data).map((field) => ({ node, field })))
  if (clipped.length) {
    findings.push({ code: "clipped-label", nodeIds: [...new Set(clipped.map((entry) => entry.node.id))], edgeIds: [],
      message: `${clipped.map(({ node, field }) => `${node.data.name} (${field})`).join(", ")} won't fit on the card and will be cut off. Names wrap to two lines of about ${NAME_CHARS_PER_LINE} characters and subtitles to two lines of about ${SUBTITLE_CHARS_PER_LINE}. Shorten them and move detail into the note.` })
  }
  return {
    summary: { nodes: document.nodes.length, edges: document.edges.length, maxConnections: Math.max(0, ...[...incident.values()].map((ids) => ids.length)) },
    findings,
    guidance: "These are review prompts, not a score or proof of visual quality. Revise or justify findings before creating; do not invent services or remove essential flows to meet a threshold. This review does not simulate routed crossings or inspect a rendered preview.",
  }
}
