import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import { z } from "zod"
import { documentSchema, MAX_MCP_BODY_BYTES, prepareDocument } from "./document.js"
import { searchCatalog } from "./catalog.js"

type Allowance = { allowed: boolean; retryAfter: number }
export type McpDependencies = {
  publicUrl: string
  consumeRequest: () => Promise<Allowance>
  consumeCreation: () => Promise<Allowance>
  insertProject: (document: string) => Promise<{ id: string }>
}

function message(error: string, status: number, headers: Record<string, string> = {}): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

export async function handleMcp(request: Request, dependencies: McpDependencies): Promise<Response> {
  const { publicUrl } = dependencies
  if (!publicUrl) return message("MCP is not configured.", 503)
  let base: URL
  try {
    base = new URL(publicUrl)
    if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname))) throw new Error()
    if (base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new Error()
  } catch {
    return message("MCP public URL is invalid.", 503)
  }
  const origin = request.headers.get("origin")
  if (origin && origin !== base.origin) return message("Origin is not allowed.", 403)
  if (request.method !== "POST") return message("Use POST for this stateless MCP endpoint.", 405, { Allow: "POST" })
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return message("Use application/json.", 415)

  try {
    const allowance = await dependencies.consumeRequest()
    if (!allowance.allowed) return message("MCP request limit reached.", 429, { "Retry-After": String(allowance.retryAfter) })

    const handler = createMcpHandler(() => {
      const server = new McpServer({ name: "stack-architect", version: "1.0.0" })
      server.registerTool("search_architecture_icons", {
        title: "Find architecture icons",
        description: "Search the editor's full icon catalog before creating a diagram. Batch technology names in queries, e.g. [Astro, Sentry, Mercado Pago, Convex]. Returns exact slugs and categories for tech nodes and group icons. Prefer a matching brand over a generic service/thirdparty icon; use generic building blocks only for unnamed components or no match. Read-only; does not create a project or consume creation quota.",
        inputSchema: z.object({
          queries: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
          limit: z.number().int().min(1).max(20).default(5),
        }).strict(),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      }, async ({ queries, limit }) => {
        const result = { matches: searchCatalog(queries, limit) }
        return { structuredContent: result, content: [{ type: "text", text: JSON.stringify(result) }] }
      })
      server.registerTool("create_architecture_project", {
        title: "Create an editable architecture diagram",
        description: "Validate, lay out and save a GraphDocument. First use search_architecture_icons for exact brand slugs. Compose a selective architecture overview: groups represent deployment/application boundaries, with optional brand icons and nested groups; keep tooling separate from runtime. Use edge data.colorOverride with a small consistent palette, solid for primary calls and dashed for secondary/async relationships, short labels, and a text legend if needed. Connect to a group when the relationship concerns the whole subsystem instead of duplicating arrows to every child. The server places nodes, sizes groups and distributes arrow endpoints around their sides; omit coordinates. Returns a public link that opens an editable local copy in Stack Architect. Anyone with the link can read the diagram. Send architecture summaries only, never secrets or source files. Creation is not idempotent; do not retry an ambiguous timeout automatically.",
        inputSchema: z.object({ document: documentSchema }).strict(),
        outputSchema: z.object({ projectId: z.string(), url: z.string(), editing: z.literal("local-copy") }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      }, async ({ document }) => {
        try {
          const quota = await dependencies.consumeCreation()
          if (!quota.allowed) return { isError: true, content: [{ type: "text", text: `Creation limit reached. Retry after ${quota.retryAfter} seconds.` }] }
          const graph = prepareDocument(document)
          const project = await dependencies.insertProject(JSON.stringify(graph))
          const url = new URL(base)
          url.searchParams.set("project", project.id)
          const result = { projectId: project.id, url: url.toString(), editing: "local-copy" as const }
          return { structuredContent: result, content: [{ type: "text", text: JSON.stringify(result) }] }
        } catch {
          return { isError: true, content: [{ type: "text", text: "Project creation failed. A save may have completed; do not retry automatically." }] }
        }
      })
      return server
    }, { maxSubscriptions: 0, maxRequestBodySize: MAX_MCP_BODY_BYTES })
    // The SDK handles protocol negotiation and legacy Streamable HTTP clients.
    // Each call owns its server; no sessions or transports survive the request.
    const response = await handler.fetch(request)
    response.headers.set("Cache-Control", "no-store")
    return response
  } catch {
    return message("MCP is temporarily unavailable.", 503)
  }
}
