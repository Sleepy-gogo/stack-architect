import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { absoluteRect } from "../../src/lib/geometry.js"
import { estimateLabelBoxes, type EdgeRoute } from "../../src/lib/edge-routing.js"
import { roundedPath } from "../../src/lib/orthogonal-route.js"
import type { GraphDocument } from "../../src/lib/types.js"

/**
 * Rough SVG of a laid-out document, written only when LAYOUT_PREVIEW_DIR is
 * set. Cards show their slug instead of artwork; geometry matches the editor.
 */
export function writePreview(name: string, doc: GraphDocument, routes: Map<string, EdgeRoute>) {
  const dir = process.env.LAYOUT_PREVIEW_DIR
  if (!dir) return
  const byId = new Map(doc.nodes.map((node) => [node.id, node]))
  const rects = doc.nodes.map((node) => absoluteRect(node, byId))
  const pad = 48
  const minX = Math.min(...rects.map((r) => r.x)) - pad
  const minY = Math.min(...rects.map((r) => r.y)) - pad
  const w = Math.max(...rects.map((r) => r.x + r.w)) - minX + pad
  const h = Math.max(...rects.map((r) => r.y + r.h)) - minY + pad
  const esc = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX} ${minY} ${w} ${h}" font-family="Segoe UI, sans-serif">`
  svg += `<defs><pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="#eef1f5"/></pattern>`
  svg += `<marker id="arrow" viewBox="0 0 10 10" refX="8.75" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0.5L9.5 5L0 9.5z" fill="context-stroke"/></marker>`
  for (const [id, route] of routes) {
    if (!route.gaps.length) continue
    svg += `<mask id="gap-${id}" maskUnits="userSpaceOnUse" x="${minX}" y="${minY}" width="${w}" height="${h}"><rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#fff"/>`
    for (const gap of route.gaps) svg += `<rect x="${gap.x}" y="${gap.y}" width="${gap.w}" height="${gap.h}" fill="#000"/>`
    svg += `</mask>`
  }
  svg += `</defs><rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#fafbfc"/><rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="url(#grid)"/>`
  for (const node of doc.nodes) {
    const r = absoluteRect(node, byId)
    if (node.type === "group") {
      const data = node.data as { label: string; color: string }
      svg += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="16" fill="${data.color}0d" stroke="${data.color}" stroke-width="1.5"/>`
      svg += `<text x="${r.x + 28}" y="${r.y + 4}" font-size="11" font-weight="600" fill="${data.color}" letter-spacing="1.5">${esc(data.label.toUpperCase())}</text>`
    } else if (node.type === "legend") {
      svg += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="10" fill="#fff" stroke="#cbd5e1"/><text x="${r.x + 12}" y="${r.y + 20}" font-size="11" fill="#64748b">legend</text>`
    } else if (node.type === "text") {
      svg += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="#cbd5e1" stroke-dasharray="3 3"/>`
    }
  }
  for (const edge of doc.edges) {
    const route = routes.get(edge.id)
    if (!route) continue
    const dashed = edge.data?.style === "dashed"
    const color = edge.data?.colorOverride ?? (dashed ? "#94a3b8" : "#2563eb")
    svg += `<path d="${roundedPath(route.points)}" fill="none" stroke="${color}" stroke-width="2" ${dashed ? 'stroke-dasharray="7 6"' : ""} marker-end="url(#arrow)" ${route.gaps.length ? `mask="url(#gap-${edge.id})"` : ""}/>`
  }
  for (const node of doc.nodes.filter((entry) => entry.type === "tech")) {
    const r = absoluteRect(node, byId)
    const data = node.data as { slug: string; name: string; subtitle: string }
    svg += `<rect x="${r.x + 28}" y="${r.y}" width="92" height="92" rx="18" fill="#fff" stroke="#e2e8f0"/><text x="${r.x + 74}" y="${r.y + 50}" text-anchor="middle" font-size="11" fill="#94a3b8">${esc(data.slug)}</text>`
    const [nameBox, subtitleBox] = estimateLabelBoxes(node) ?? []
    if (nameBox) svg += `<text x="${r.x + 74}" y="${r.y + nameBox.y + 15}" text-anchor="middle" font-size="15" font-weight="600" fill="#0f172a">${esc(data.name)}</text>`
    if (subtitleBox) svg += `<text x="${r.x + 74}" y="${r.y + subtitleBox.y + 11}" text-anchor="middle" font-size="11" font-family="Consolas" fill="#64748b">${esc(data.subtitle)}</text>`
  }
  for (const edge of doc.edges) {
    const route = routes.get(edge.id)
    const label = edge.data?.label
    if (!route || !label) continue
    let best = 0
    let bestLength = -1
    for (let index = 1; index < route.points.length; index += 1) {
      const length = Math.abs(route.points[index].x - route.points[index - 1].x) + Math.abs(route.points[index].y - route.points[index - 1].y)
      if (length > bestLength) { best = index; bestLength = length }
    }
    const a = route.points[best - 1]
    const b = route.points[best]
    const vertical = a.x === b.x
    svg += `<text x="${(a.x + b.x) / 2 + (vertical ? 8 : 0)}" y="${(a.y + b.y) / 2 + (vertical ? 4 : -7)}" text-anchor="${vertical ? "start" : "middle"}" font-size="11" font-family="Consolas" fill="#334155" stroke="#fafbfc" stroke-width="4" paint-order="stroke">${esc(label)}</text>`
  }
  svg += "</svg>"
  writeFileSync(join(dir, `${name}.svg`), svg)
}
