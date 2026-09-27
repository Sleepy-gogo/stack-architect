import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { PROTOCOL_VERSION_META_KEY, CLIENT_INFO_META_KEY, CLIENT_CAPABILITIES_META_KEY } from "@modelcontextprotocol/server"
import { handleMcp, type McpDependencies } from "../server/mcp/handler.js"
import { MAX_MCP_BODY_BYTES, prepareDocument } from "../server/mcp/document.js"
import type { GraphDocument } from "../src/lib/types.js"
import { svglExportNames } from "../src/lib/icon-names-generated.js"

const tech = (id: string, parentId?: string) => ({ id, type: "tech", parentId, data: { slug: "service", name: id, subtitle: "API", category: "backend" } })
const graph = () => ({ version: 1, title: "Example", nodes: [tech("web"), tech("api")], edges: [{ id: "request", source: "web", target: "api", data: { label: "HTTPS" } }] })

test("lightweight icon metadata matches the installed artwork exports", async () => {
  const icons = await import("@ridemountainpig/svgl-react")
  const actual = [...new Set(Object.entries(icons)
    .filter(([, value]) => typeof value === "function")
    .map(([name]) => name.replace(/(Dark|Light)$/u, "").toLowerCase()))].sort()
  assert.deepEqual(svglExportNames, actual)
})
function setup(overrides: Partial<McpDependencies> = {}) {
  const saved: GraphDocument[] = []
  let requests = 0
  const dependencies: McpDependencies = {
    publicUrl: "https://architect.example",
    consumeRequest: async () => { requests++; return { allowed: true, retryAfter: 1 } },
    consumeCreation: async () => ({ allowed: true, retryAfter: 1 }),
    insertProject: async (document) => { saved.push(JSON.parse(document)); return { id: "abc123DEF456", editToken: "must-not-leak" } },
    ...overrides,
  }
  return { saved, requests: () => requests, dependencies }
}
function request(body: unknown, headers: Record<string, string> = {}, method = "POST") {
  return new Request("https://architect.example/api/mcp", {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...headers },
    ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  })
}
const call = (document: unknown = graph()) => ({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_architecture_project", arguments: { document } } })
async function result(response: Response) {
  const text = await response.text()
  assert.equal(response.status, 200, text)
  const data = text.startsWith("event:") ? text.split("\n").find((line) => line.startsWith("data: "))!.slice(6) : text
  return JSON.parse(data)
}

test("rejects invalid configuration, foreign origins and unsupported methods before storage", async () => {
  const ctx = setup()
  assert.equal((await handleMcp(request(call(), { Origin: "https://foreign.example" }), ctx.dependencies)).status, 403)
  assert.equal((await handleMcp(request(null, {}, "GET"), ctx.dependencies)).status, 405)
  assert.equal((await handleMcp(request(call()), { ...ctx.dependencies, publicUrl: "" })).status, 503)
  assert.equal((await handleMcp(request(call()), { ...ctx.dependencies, publicUrl: "http://untrusted.example" })).status, 503)
  assert.equal(ctx.requests(), 0)
  assert.equal(ctx.saved.length, 0)
})

test("anonymous clients can initialize, discover tools and create projects", async () => {
  const ctx = setup()
  const initialized = await result(await handleMcp(request({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } } }), ctx.dependencies))
  assert.equal(initialized.result.serverInfo.name, "stack-architect")
  const discovery = await result(await handleMcp(request({ jsonrpc: "2.0", id: 2, method: "tools/list" }), ctx.dependencies))
  assert.equal(discovery.result.tools.length, 2)
  assert.equal(discovery.result.tools.find((tool: { name: string }) => tool.name === "create_architecture_project").annotations.idempotentHint, false)
  const created = await result(await handleMcp(request(call()), ctx.dependencies))
  assert.deepEqual(created.result.structuredContent, { projectId: "abc123DEF456", url: "https://architect.example/?project=abc123DEF456", editing: "local-copy" })
  assert.equal(JSON.stringify(created).includes("must-not-leak"), false)
  assert.equal(ctx.saved.length, 1)
  assert.equal(ctx.saved[0].title, "Example")
  assert.notDeepEqual(ctx.saved[0].nodes[0].position, ctx.saved[0].nodes[1].position)
  assert.equal(ctx.saved[0].edges[0].type, "tech")
})

test("icon discovery searches the editor catalog without consuming creation quota", async () => {
  const ctx = setup({ consumeCreation: async () => { throw new Error("Search must not consume creation quota") } })
  const response = await result(await handleMcp(request({ jsonrpc: "2.0", id: 2, method: "tools/call", params: {
    name: "search_architecture_icons", arguments: { queries: ["Astro", "Sentry", "Mercado Pago", "Next.js", "a-brand-that-does-not-exist"], limit: 3 },
  } }), ctx.dependencies))
  const matches = response.result.structuredContent.matches
  assert.deepEqual(matches.slice(0, 4).map((match: { items: { slug: string }[] }) => match.items[0].slug), ["astro", "sentry", "mercadopago", "nextjs"])
  assert.equal(matches[4].total, 0)
  assert.equal(ctx.saved.length, 0)
})

test("documented styled example survives validation, layout and persistence", async () => {
  const markdown = readFileSync(new URL("../skills/stack-architect/references/graph-input.md", import.meta.url), "utf8")
  const { document } = JSON.parse(markdown.match(/```json\s*([\s\S]*?)```/u)![1])
  const ctx = setup()
  const response = await result(await handleMcp(request(call(document)), ctx.dependencies))
  assert.equal(response.result.isError, undefined)
  assert.equal(ctx.saved.length, 1)
  for (const edge of ctx.saved[0].edges) {
    const original = document.edges.find((entry: { id: string }) => entry.id === edge.id)
    assert.equal(edge.data?.colorOverride, original.data.colorOverride)
    assert.equal(edge.data?.style, original.data.style)
    assert.ok(edge.data?.sourcePoint)
    assert.ok(edge.data?.targetPoint)
  }
})

test("all catalog categories are accepted and invalid icons and colors fail before saving", async () => {
  const { techCatalog } = await import("../src/lib/catalog.js")
  for (const category of new Set(techCatalog.map((item) => item.category))) {
    const item = techCatalog.find((entry) => entry.category === category)!
    assert.doesNotThrow(() => prepareDocument({ version: 1, title: category, nodes: [{ id: "a", type: "tech", data: {
      slug: item.slug, name: item.name, subtitle: item.subtitle, category,
    } }], edges: [] }))
  }
  assert.throws(() => prepareDocument({ ...graph(), nodes: [{ ...tech("web"), data: { ...tech("web").data, slug: "nonexistent-brand" } }, tech("api")] }), /search_architecture_icons/u)
  const ctx = setup()
  const invalid = { ...graph(), edges: [{ id: "e", source: "web", target: "api", data: { colorOverride: "url(https://invalid.example)" } }] }
  const response = await result(await handleMcp(request(call(invalid)), ctx.dependencies))
  assert.ok(response.result?.isError || response.error)
  assert.equal(ctx.saved.length, 0)
})

test("obsolete authorization headers do not affect public access", async () => {
  const ctx = setup()
  const response = await handleMcp(request(call(), { Authorization: "Bearer unused-old-token" }), ctx.dependencies)
  assert.equal(response.headers.get("www-authenticate"), null)
  assert.equal(response.headers.get("cache-control"), "no-store")
  const created = await result(response)
  assert.equal(created.result.structuredContent.projectId, "abc123DEF456")
  assert.equal(ctx.saved.length, 1)
})

test("invalid graphs never reach persistence", async () => {
  const ctx = setup()
  const invalid = graph()
  invalid.edges[0].target = "missing"
  const response = await result(await handleMcp(request(call(invalid)), ctx.dependencies))
  assert.ok(response.result?.isError || response.error)
  assert.equal(ctx.saved.length, 0)
})

test("current protocol creates a project without an initialization session", async () => {
  const ctx = setup()
  const body = call()
  const response = await result(await handleMcp(request({ ...body, params: { ...body.params, _meta: {
    [PROTOCOL_VERSION_META_KEY]: "2026-07-28",
    [CLIENT_INFO_META_KEY]: { name: "test", version: "1" },
    [CLIENT_CAPABILITIES_META_KEY]: {},
  } } }, { "MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "tools/call", "Mcp-Name": "create_architecture_project" }), ctx.dependencies))
  assert.equal(response.result.structuredContent.projectId, "abc123DEF456")
  assert.equal(ctx.saved.length, 1)
})

test("request and creation quotas prevent writes and expose retry guidance", async () => {
  const ctx = setup({ consumeRequest: async () => ({ allowed: false, retryAfter: 42 }) })
  const response = await handleMcp(request(call()), ctx.dependencies)
  assert.equal(response.status, 429)
  assert.equal(response.headers.get("retry-after"), "42")
  const daily = setup({ consumeCreation: async () => ({ allowed: false, retryAfter: 300 }) })
  const rejected = await result(await handleMcp(request(call()), daily.dependencies))
  assert.equal(rejected.result.isError, true)
  assert.equal(daily.saved.length, 0)
})

test("limits actual request bytes even without content-length; malformed JSON cannot write", async () => {
  const ctx = setup()
  const oversized = request(" ".repeat(MAX_MCP_BODY_BYTES + 1))
  assert.equal(oversized.headers.get("content-length"), null)
  assert.equal((await handleMcp(oversized, ctx.dependencies)).status, 413)
  const malformed = await handleMcp(request("{"), ctx.dependencies)
  assert.ok(malformed.status >= 400)
  assert.equal(ctx.saved.length, 0)
})

test("storage failures do not expose credentials or database details", async () => {
  const ctx = setup({ insertProject: async () => { throw new Error("private-turso-credential") } })
  const failed = await result(await handleMcp(request(call()), ctx.dependencies))
  assert.equal(failed.result.isError, true)
  assert.equal(JSON.stringify(failed).includes("private-turso-credential"), false)
})

test("schema rejects duplicate IDs, missing parents, group cycles, unsafe props and unbounded graphs", () => {
  assert.throws(() => prepareDocument({ ...graph(), nodes: [tech("a"), tech("a")] }))
  assert.throws(() => prepareDocument({ ...graph(), nodes: [tech("a", "missing")] }))
  const group = (id: string, parentId: string) => ({ id, parentId, type: "group", data: { label: id, color: "#abcdef" } })
  assert.throws(() => prepareDocument({ ...graph(), nodes: [group("a", "b"), group("b", "a")] }))
  assert.throws(() => prepareDocument({ ...graph(), nodes: [{ ...tech("a"), style: { backgroundImage: "url(https://tracker.example)" } }] }))
  assert.throws(() => prepareDocument({ ...graph(), nodes: Array.from({ length: 81 }, (_, n) => tech(`n${n}`)) }))
  assert.throws(() => prepareDocument({ ...graph(), version: 2 }))
})

test("nested groups are sized around laid out children and parents precede children", () => {
  const doc = prepareDocument({ version: 1, title: "Groups", nodes: [tech("a", "inner"), tech("b", "inner"),
    { id: "inner", parentId: "outer", type: "group", data: { label: "Inner", color: "#abcdef" } },
    { id: "outer", type: "group", data: { label: "Outer", color: "#abcdef" } }],
    edges: [{ id: "ab", source: "a", target: "b" }],
  })
  assert.deepEqual(doc.nodes.map((node) => node.id), ["outer", "inner", "a", "b"])
  const [outer, inner, a, b] = doc.nodes
  assert.notDeepEqual(a.position, b.position)
  assert.ok(inner.width! >= Math.max(a.position.x, b.position.x) + 148)
  assert.ok(outer.width! >= inner.position.x + inner.width!)
  assert.ok(outer.height! >= inner.position.y + inner.height!)
  assert.equal(doc.edges[0].source, "a")
  assert.deepEqual(prepareDocument({ version: 1, title: "Empty group", nodes: [{ id: "g", type: "group", data: { label: "G", color: "#abcdef" } }], edges: [] }).nodes[0].width, 240)
})
