import assert from "node:assert/strict"
import { test } from "node:test"
import { Position } from "@xyflow/react"
import { addRouteBend, moveRouteSegment, readRoute, resolveManualRoute, routeSegments } from "../src/lib/editable-route.js"
import { getObstacleAvoidingPath, roundedPath, simplifyRoute, type RoutePoint } from "../src/lib/orthogonal-route.js"

const stepped = [{ x: 0, y: 0 }, { x: 160, y: 0 }, { x: 160, y: 180 }, { x: 400, y: 180 }]

function orthogonal(points: RoutePoint[]) {
  assert.ok(points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y,
      `Diagonal segment: ${JSON.stringify(points)}`)
  }
  assert.ok(!roundedPath(points).includes("NaN"))
}

test("moving a middle lane moves both bends, leaving attachments and input untouched", () => {
  const original = structuredClone(stepped)
  const moved = moveRouteSegment(stepped, 1, 64)
  assert.deepEqual(moved, [stepped[0], { x: 224, y: 0 }, { x: 224, y: 180 }, stepped[3]])
  assert.deepEqual(stepped, original)
  orthogonal(moved)
})

test("first, last and straight segments gain bends without detaching endpoints", () => {
  for (const route of [stepped, [stepped[0], { x: 400, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: -300 }]]) {
    for (const { index } of routeSegments(route)) {
      for (const delta of [-80, 1, 80]) {
        const moved = moveRouteSegment(route, index, delta)
        assert.deepEqual(moved[0], route[0])
        assert.deepEqual(moved.at(-1), route.at(-1))
        orthogonal(moved)
      }
    }
  }
})

test("repeated detours and edits create an arbitrary multi-bend route", () => {
  let route = stepped
  for (let i = 0; i < 8; i++) {
    route = addRouteBend(route, i)
    route = moveRouteSegment(route, i + 2, 24)
    orthogonal(route)
  }
  assert.equal(route.length, stepped.length + 32)
  assert.deepEqual(readRoute(JSON.parse(JSON.stringify(route))), simplifyRoute(route))
})

test("moving both nodes translates the complete manual route", () => {
  const moved = resolveManualRoute(stepped, { x: 100, y: -50 }, { x: 500, y: 130 }, Position.Right, Position.Left)
  assert.deepEqual(moved, stepped.map((p) => ({ x: p.x + 100, y: p.y - 50 })))
})

test("moved and reconnected endpoints remain orthogonal on every attachment side", () => {
  for (const sourceSide of Object.values(Position)) {
    for (const targetSide of Object.values(Position)) {
      for (const route of [stepped, addRouteBend(stepped, 1), [stepped[0], { x: 400, y: 0 }]]) {
        for (const source of [{ x: -100, y: 70 }, { x: 600, y: 300 }]) {
          const target = { x: 350, y: -40 }
          const moved = resolveManualRoute(route, source, target, sourceSide, targetSide)
          assert.deepEqual(moved[0], source)
          assert.deepEqual(moved.at(-1), target)
          orthogonal(moved)
        }
      }
    }
  }
})

test("invalid imported routes fall back to automatic routing", () => {
  for (const value of [undefined, [], [null, null], [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    [{ x: NaN, y: 0 }, { x: 1, y: 0 }], [{ x: 0, y: 0 }, { x: 0, y: 0 }]]) {
    assert.equal(readRoute(value), null)
  }
})

test("automatic routes expose editable geometry and retain obstacle clearance", () => {
  const [path, , , points] = getObstacleAvoidingPath({ source: { x: 0, y: 0 }, target: { x: 400, y: 0 },
    sourcePosition: Position.Right, targetPosition: Position.Left,
    obstacles: [{ x: 120, y: -50, w: 100, h: 100 }] })
  orthogonal(points)
  assert.equal(roundedPath(points), path)
  assert.ok(points.some((p) => Math.abs(p.y) >= 50))
})
