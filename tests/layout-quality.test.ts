import assert from "node:assert/strict"
import { test } from "node:test"
import { prepareDocument } from "../server/mcp/document.js"
import { measureRoutes, routeEdges, type RouteQuality } from "../src/lib/edge-routing.js"
import { samples, synthetic } from "./fixtures/diagrams.js"
import { writePreview } from "./fixtures/preview.js"
import { absoluteRect, rectsIntersect } from "../src/lib/geometry.js"
import { frameHeadingWidth } from "../src/lib/label-text.js"

/**
 * Regression budgets for MCP-created diagrams, measured on the routed result.
 * Lower is better for everything but `straight`. Tighten these when layout
 * improves; a change that loosens them needs a reason.
 */
const budgets: Record<keyof typeof samples, Partial<RouteQuality>> = {
  hero: { straight: 3, bends: 6, jogs: 0, throughLabels: 0, crossings: 0, sharedLane: 0 },
  saas: { straight: 4, bends: 25, jogs: 1, throughLabels: 0, crossings: 9, sharedLane: 40 },
  monorepo: { straight: 6, bends: 30, jogs: 1, throughLabels: 0, crossings: 10, sharedLane: 40 },
  self: { throughLabels: 0 },
}

for (const [name, input] of Object.entries(samples) as [keyof typeof samples, unknown][]) {
  test(`layout quality: ${name}`, async (t) => {
    const doc = await prepareDocument(input)
    const routes = routeEdges(doc.nodes, doc.edges)
    writePreview(name, doc, routes)
    const quality = measureRoutes(routes, doc.nodes)
    t.diagnostic(JSON.stringify(quality))
    const budget = budgets[name]
    assert.equal(quality.edges, doc.edges.length, "every arrow is routed")
    if (budget.straight !== undefined) assert.ok(quality.straight >= budget.straight, `straight ${quality.straight} < ${budget.straight}`)
    for (const key of ["bends", "jogs", "throughLabels", "crossings", "sharedLane"] as const) {
      const limit = budget[key]
      if (limit !== undefined) assert.ok(quality[key] <= limit, `${key} ${quality[key]} > ${limit}`)
    }
  })
}

test("routing stays interactive while dragging", async (t) => {
  const time = (run: () => void, runs = 5) => {
    run()
    const start = performance.now()
    for (let index = 0; index < runs; index += 1) run()
    return (performance.now() - start) / runs
  }
  const typical = await prepareDocument(samples.monorepo)
  const largest = await prepareDocument(synthetic())
  const typicalMs = time(() => routeEdges(typical.nodes, typical.edges))
  const largestMs = time(() => routeEdges(largest.nodes, largest.edges))
  const largestDragMs = time(() => routeEdges(largest.nodes, largest.edges, undefined, { aware: false }))
  t.diagnostic(`monorepo: ${typicalMs.toFixed(1)}ms; 80 nodes / 160 arrows: ${largestMs.toFixed(1)}ms, ${largestDragMs.toFixed(1)}ms while dragging`)
  // Generous ceilings: CI machines are slower than a laptop, and these catch
  // complexity regressions rather than small slowdowns.
  assert.ok(typicalMs < 60, `typical diagram took ${typicalMs.toFixed(1)}ms`)
  assert.ok(largestDragMs < 120, `largest diagram took ${largestDragMs.toFixed(1)}ms while dragging`)
  assert.ok(largestMs < 600, `largest diagram took ${largestMs.toFixed(1)}ms`)
})

test("reference frames pack into rows and the diagram fits a laptop view", async () => {
  const doc = await prepareDocument(samples.self)
  const byId = new Map(doc.nodes.map((node) => [node.id, node]))
  const rects = new Map(doc.nodes.map((node) => [node.id, absoluteRect(node, byId)]))
  const all = [...rects.values()]
  const w = Math.max(...all.map((r) => r.x + r.w)) - Math.min(...all.map((r) => r.x))
  const h = Math.max(...all.map((r) => r.y + r.h)) - Math.min(...all.map((r) => r.y))
  const fitZoom = Math.min(1600 / w, 900 / h)
  assert.ok(fitZoom >= 0.7, `a 1600x900 view fits the diagram at ${fitZoom.toFixed(2)}`)
  for (const frame of ["shared", "tooling"]) {
    const kids = doc.nodes.filter((node) => node.parentId === frame).map((node) => rects.get(node.id)!)
    assert.ok(kids.length >= 3)
    assert.ok(new Set(kids.map((r) => r.y)).size < kids.length, `${frame} stacks its cards in one column`)
  }
  // Siblings never overlap, and every frame is wide enough for its heading.
  for (const node of doc.nodes) {
    if (node.type === "group") assert.ok(rects.get(node.id)!.w >= frameHeadingWidth((node.data as { label: string }).label), `${node.id} clips its heading`)
    for (const other of doc.nodes) {
      if (other.id <= node.id || other.parentId !== node.parentId) continue
      assert.ok(!rectsIntersect(rects.get(node.id)!, rects.get(other.id)!), `${node.id} overlaps ${other.id}`)
    }
  }
})

test("frames without arrows go in a strip under the arrow flow", async () => {
  const doc = await prepareDocument({ version: 1, title: "Strip", nodes: [
    { id: "a", type: "tech", data: { slug: "service", name: "A", subtitle: "api", category: "backend" } },
    { id: "b", type: "tech", data: { slug: "datastore", name: "B", subtitle: "db", category: "database" } },
    { id: "lib", type: "group", data: { label: "Shared packages", color: "#64748b" } },
    ...["x", "y", "z", "w", "v"].map((id) => ({ id, type: "tech", parentId: "lib", data: { slug: "typescript", name: id, subtitle: "package", category: "language" } })),
  ], edges: [{ id: "ab", source: "a", target: "b" }] })
  const byId = new Map(doc.nodes.map((node) => [node.id, node]))
  const lib = absoluteRect(byId.get("lib")!, byId)
  const a = absoluteRect(byId.get("a")!, byId)
  assert.ok(lib.y > a.y + a.h, "the reference frame sits below the flow")
  const rows = new Set(doc.nodes.filter((node) => node.parentId === "lib").map((node) => node.position.y))
  assert.equal(rows.size, 2, "five packages wrap into two rows")
})
