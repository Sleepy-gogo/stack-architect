import assert from "node:assert/strict"
import { test } from "node:test"
import { reviewDocument } from "../server/mcp/review.js"

const node = (id: string, parentId?: string) => ({ id, type: "tech", parentId, data: { slug: "service", name: id, subtitle: "", category: "backend" } })
const frame = (id: string, color = "#64748b", parentId?: string) => ({ id, type: "group", parentId, data: { label: id, color } })
const edge = (id: string, source: string, target: string) => ({ id, source, target })

test("counts requests and callbacks together and identifies the crowded component", () => {
  const peers = Array.from({ length: 7 }, (_, i) => node(`peer${i}`))
  const doc = { version: 1, title: "Integrations", nodes: [node("functions"), ...peers], edges: peers.flatMap((peer, i) => [
    edge(`call${i}`, "functions", peer.id), edge(`callback${i}`, peer.id, "functions"),
  ]) }
  const original = structuredClone(doc)
  const review = reviewDocument(doc)
  const crowded = review.findings.filter((finding) => finding.code === "crowded-node")
  assert.equal(crowded.length, 1)
  assert.deepEqual(crowded[0].nodeIds, ["functions"])
  assert.equal(crowded[0].edgeIds.length, 14)
  assert.equal(review.summary.maxConnections, 14)
  assert.ok(review.findings.some((finding) => finding.code === "dense-overview"))
  assert.deepEqual(doc, original)
})

test("wrapping a hub in nested frames still exposes boundary crossings", () => {
  const peers = Array.from({ length: 8 }, (_, i) => node(`peer${i}`))
  const doc = { version: 1, title: "Nested backend", nodes: [frame("outer"), frame("backend", "#0d9488", "outer"), node("hub", "backend"), node("db", "backend"), ...peers],
    edges: [edge("local", "hub", "db"), ...peers.map((peer, i) => edge(`e${i}`, "hub", peer.id))] }
  const boundaries = reviewDocument(doc).findings.filter((finding) => finding.code === "busy-boundary")
  assert.equal(boundaries.length, 2)
  for (const finding of boundaries) {
    assert.equal(finding.edgeIds.length, 8)
    assert.equal(finding.edgeIds.includes("local"), false)
  }
})

test("pale frame colors remain valid but trigger an accent recommendation", () => {
  const colors = ["#ddd6fe", "#dbeafe", "#ccfbf1", "#f1f5f9", "#8b5cf6", "#0d9488", "#64748b", "#0f172a"]
  const review = reviewDocument({ version: 1, title: "Colors", nodes: colors.map((color, i) => frame(`f${i}`, color)), edges: [] })
  assert.deepEqual(review.findings.map((finding) => finding.nodeIds[0]), ["f0", "f1", "f2", "f3"])
})

test("a selective overview has no structural warnings without pretending to prove readability", () => {
  const review = reviewDocument({ version: 1, title: "Overview", nodes: [node("web"), frame("backend"), node("api", "backend"), node("db", "backend")],
    edges: [edge("request", "web", "backend"), edge("queries", "api", "db")] })
  assert.deepEqual(review.findings, [])
  assert.equal(review.summary.maxConnections, 1)
})
