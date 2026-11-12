import assert from "node:assert/strict"
import { test } from "node:test"
import { prepareDocument } from "../server/mcp/document.js"
import { measureRoutes, routeEdges, type RouteQuality } from "../src/lib/edge-routing.js"
import { samples, synthetic } from "./fixtures/diagrams.js"
import { writePreview } from "./fixtures/preview.js"

/**
 * Regression budgets for MCP-created diagrams, measured on the routed result.
 * Lower is better for everything but `straight`. Tighten these when layout
 * improves; a change that loosens them needs a reason.
 */
const budgets: Record<keyof typeof samples, Partial<RouteQuality>> = {
  hero: { straight: 3, bends: 6, jogs: 0, throughLabels: 0, crossings: 0, sharedLane: 0 },
  saas: { straight: 4, bends: 25, jogs: 1, throughLabels: 0, crossings: 9, sharedLane: 40 },
  monorepo: { straight: 6, bends: 30, jogs: 1, throughLabels: 0, crossings: 10, sharedLane: 40 },
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
