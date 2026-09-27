import assert from "node:assert/strict"
import { test } from "node:test"
import { Position } from "@xyflow/react"
import { faceOf } from "../src/lib/edge-anchors.js"
import { layoutEdgeAnchors } from "../src/lib/layout-anchors.js"
import { layoutDagre } from "../src/lib/layout.js"
import type { AppEdge, AppNode } from "../src/lib/types.js"

const node = (id: string, x: number, y: number, parentId?: string): AppNode => ({ id, type: "tech", position: { x, y }, parentId, data: { slug: "service", name: id, subtitle: "", category: "generic" } })
const edge = (id: string, source: string, target: string): AppEdge => ({ id, source, target })

test("fan-out and fan-in share ordered ports without mutating the input", () => {
  const nodes = [node("hub", 0, 200), node("top", 400, 0), node("middle", 400, 200), node("bottom", 400, 400)]
  const edges = [edge("a", "hub", "top"), edge("b", "middle", "hub"), edge("c", "hub", "bottom")]
  const output = layoutEdgeAnchors(nodes, edges)
  const ports = [output[0].data!.sourcePoint!, output[1].data!.targetPoint!, output[2].data!.sourcePoint!]
  assert.ok(ports.every((point) => point.x === 1 && point.y > 0 && point.y < 1))
  assert.ok(ports[0].y < ports[1].y && ports[1].y < ports[2].y)
  assert.equal(edges[0].data, undefined)
  assert.deepEqual(layoutEdgeAnchors(nodes, edges.toReversed()).toReversed(), output)
})

test("parallel and reciprocal arrows retain separate matching lanes", () => {
  const nodes = [node("a", 0, 0), node("b", 400, 0)]
  const output = layoutEdgeAnchors(nodes, [edge("1", "a", "b"), edge("2", "b", "a"), edge("3", "a", "b")])
  assert.equal(new Set(output.map((entry) => entry.data!.sourcePoint!.y)).size, 3)
  for (const entry of output) assert.equal(entry.data!.sourcePoint!.y, entry.data!.targetPoint!.y)
})

test("nested frame coordinates determine the facing side", () => {
  const nodes: AppNode[] = [{ id: "outer", type: "group", position: { x: 700, y: 0 }, width: 400, height: 300, data: { label: "Outer", color: "#64748b" } },
    { id: "inner", type: "group", parentId: "outer", position: { x: 100, y: 50 }, data: { label: "Inner", color: "#64748b" } },
    node("child", 20, 0, "inner"), node("outside", 400, 50)]
  const [result] = layoutEdgeAnchors(nodes, [edge("e", "child", "outside")])
  assert.equal(result.data!.sourcePoint!.x, 0)
  assert.equal(result.data!.targetPoint!.x, 1)
})

test("auto-layout replaces old geometry and preserves styles, labels and topology", () => {
  const input: AppEdge = { ...edge("e", "a", "b"), data: { sourcePoint: { x: 0, y: 0.2 }, targetPoint: { x: 1, y: 0.8 }, labelX: 9999, labelY: 9999, label: "webhook", style: "dashed", colorOverride: "#0284c7" } }
  const doc = layoutDagre({ nodes: [node("a", 500, 200), node("b", 0, 0)], edges: [input] })
  assert.equal(doc.edges[0].data!.labelX, undefined)
  assert.equal(doc.edges[0].data!.labelY, undefined)
  assert.equal(doc.edges[0].data!.label, "webhook")
  assert.equal(doc.edges[0].data!.colorOverride, "#0284c7")
  assert.equal(doc.edges[0].data!.style, "dashed")
  assert.notDeepEqual(doc.edges[0].data!.sourcePoint, input.data!.sourcePoint)
  assert.deepEqual(layoutDagre(doc), doc)
})

test("perimeter points on wide and tall frames exit through their actual face", () => {
  assert.equal(faceOf({ x: 0, y: 0, w: 1200, h: 200 }, { x: 0.2, y: 0 }), Position.Top)
  assert.equal(faceOf({ x: 0, y: 0, w: 200, h: 1200 }, { x: 1, y: 0.8 }), Position.Right)
})

test("hidden or missing endpoints do not consume visible ports", () => {
  const nodes = [node("a", 0, 0), node("b", 400, 0), { ...node("hidden", 400, 100), hidden: true }]
  const output = layoutEdgeAnchors(nodes, [edge("ok", "a", "b"), edge("missing", "a", "missing"), edge("hidden", "a", "hidden")])
  assert.deepEqual(output[0].data!.sourcePoint, { x: 1, y: 0.5 })
  assert.equal(output[1].data!.sourcePoint, undefined)
  assert.equal(output[2].data!.sourcePoint, undefined)
})
