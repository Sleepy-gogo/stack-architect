/** MCP-style input documents used to measure layout and routing quality. */
type Style = "solid" | "dashed"

const tech = (id: string, slug: string, name: string, subtitle: string, category: string, parentId?: string) =>
  ({ id, type: "tech", ...(parentId ? { parentId } : {}), data: { slug, name, subtitle, category } })
const group = (id: string, label: string, color: string, icon?: string, parentId?: string) =>
  ({ id, type: "group", ...(parentId ? { parentId } : {}), data: { label, color, ...(icon ? { icon } : {}) } })
const edge = (id: string, source: string, target: string, label?: string, style: Style = "solid") =>
  ({ id, source, target, data: { ...(label ? { label } : {}), style } })

/** stack-diagram's README hero, rebuilt with our catalog. */
export const hero = {
  version: 1, title: "Hero stack",
  nodes: [
    tech("user", "browser", "User", "browser", "generic"),
    group("vercel", "Vercel", "#64748b", "vercel"),
    tech("next", "nextjs", "Next.js", "frontend", "frontend", "vercel"),
    tech("hono", "hono", "Hono", "api routes", "backend", "vercel"),
    tech("neon", "neon", "Neon", "serverless postgres", "database"),
    tech("clerk", "clerk", "Clerk", "auth", "auth"),
    tech("stripe", "stripe", "Stripe", "payments", "payment"),
    group("gh", "GitHub", "#3b82f6", "github"),
    tech("gha", "githubactions", "GitHub Actions", "ci", "devops", "gh"),
  ],
  edges: [
    edge("e1", "user", "next", "HTTPS"), edge("e2", "next", "hono", "RPC"), edge("e3", "hono", "neon", "SQL"),
    edge("e4", "hono", "clerk", "session"), edge("e5", "hono", "stripe", "checkout"),
    edge("e6", "gha", "next", "deploy", "dashed"),
  ],
}

export const saas = {
  version: 1, title: "Medium SaaS",
  nodes: [
    tech("user", "browser", "Browser", "customer", "generic"),
    group("edge", "Cloudflare", "#f97316", "cloudflare"),
    tech("web", "nextjs", "Web app", "next.js ssr", "frontend", "edge"),
    group("backend", "Backend", "#8b5cf6", "hono"),
    tech("api", "hono", "API", "rest routes", "backend", "backend"),
    tech("jobs", "inngest", "Jobs", "background work", "backend", "backend"),
    tech("auth", "clerk", "Auth", "sessions", "auth", "backend"),
    group("data", "Data", "#0d9488"),
    tech("db", "postgresql", "Postgres", "primary store", "database", "data"),
    tech("cache", "redis", "Redis", "cache", "database", "data"),
    tech("stripe", "stripe", "Stripe", "payments", "payment"),
    tech("ai", "anthropic", "Claude", "llm", "ai"),
    tech("notion", "notion", "Notion", "docs source", "productivity"),
    group("tools", "Tooling", "#64748b", "github"),
    tech("gha", "githubactions", "GitHub Actions", "ci / deploy", "devops", "tools"),
  ],
  edges: [
    edge("e1", "user", "web", "HTTPS"), edge("e2", "web", "api", "RPC"), edge("e3", "api", "db", "SQL"),
    edge("e4", "api", "cache", "cache"), edge("e5", "api", "auth", "session"), edge("e6", "api", "stripe", "checkout"),
    edge("e7", "stripe", "api", "webhook", "dashed"), edge("e8", "api", "jobs", "enqueue"), edge("e9", "jobs", "ai", "prompt"),
    edge("e10", "jobs", "notion", "sync", "dashed"), edge("e11", "jobs", "db", "embeddings"),
    edge("e12", "gha", "web", "deploy", "dashed"), edge("e13", "gha", "api", "deploy", "dashed"),
  ],
}

export const monorepo = {
  version: 1, title: "Monorepo platform",
  nodes: [
    tech("customer", "browser", "Customer", "web + mobile", "generic"),
    tech("admin", "browser", "Admin", "back office", "generic"),
    group("vercel", "Vercel", "#64748b", "vercel"),
    tech("site", "nextjs", "Storefront", "next.js", "frontend", "vercel"),
    tech("dash", "react", "Dashboard", "react spa", "frontend", "vercel"),
    group("api", "API", "#8b5cf6", "node"),
    tech("gateway", "hono", "Gateway", "routing", "backend", "api"),
    tech("orders", "node", "Orders", "order service", "backend", "api"),
    tech("billing", "node", "Billing", "invoices", "backend", "api"),
    tech("search", "node", "Search", "indexing", "backend", "api"),
    group("data", "Data", "#0d9488"),
    tech("pg", "postgresql", "Postgres", "orders db", "database", "data"),
    tech("redis", "redis", "Redis", "sessions", "database", "data"),
    tech("meili", "elasticsearch", "Elasticsearch", "search index", "database", "data"),
    tech("stripe", "stripe", "Stripe", "payments", "payment"),
    tech("resend", "resend", "Resend", "email", "productivity"),
    tech("sentry", "sentry", "Sentry", "errors", "monitoring"),
    tech("s3", "bucket", "Assets", "object storage", "hosting"),
    group("ci", "CI", "#64748b", "github"),
    tech("gha", "githubactions", "GitHub Actions", "build", "devops", "ci"),
    tech("turbo", "turborepo", "Turborepo", "task runner", "tooling", "ci"),
  ],
  edges: [
    edge("m1", "customer", "site", "HTTPS"), edge("m2", "admin", "dash", "HTTPS"),
    edge("m3", "site", "gateway", "REST"), edge("m4", "dash", "gateway", "REST"),
    edge("m5", "gateway", "orders"), edge("m6", "gateway", "billing"), edge("m7", "gateway", "search"),
    edge("m8", "orders", "pg", "SQL"), edge("m9", "billing", "pg", "SQL"), edge("m10", "gateway", "redis", "session"),
    edge("m11", "search", "meili", "query"), edge("m12", "billing", "stripe", "charge"),
    edge("m13", "stripe", "billing", "webhook", "dashed"), edge("m14", "orders", "resend", "receipt"),
    edge("m15", "site", "s3", "assets"), edge("m16", "gateway", "sentry", "errors", "dashed"),
    edge("m17", "gha", "site", "deploy", "dashed"), edge("m18", "gha", "gateway", "deploy", "dashed"),
    edge("m19", "turbo", "gha", "build", "dashed"),
  ],
}

/** Worst case the MCP accepts: 80 nodes and 160 arrows, for timing only. */
export function synthetic(nodeCount = 80, edgeCount = 160) {
  const nodes: unknown[] = []
  const groups = 8
  for (let g = 0; g < groups; g += 1) nodes.push(group(`g${g}`, `Group ${g}`, "#64748b"))
  for (let n = 0; n < nodeCount - groups; n += 1) {
    nodes.push(tech(`n${n}`, "postgresql", `Node ${n}`, "service", "backend", n % 3 === 0 ? undefined : `g${n % groups}`))
  }
  const edges: unknown[] = []
  let seed = 7
  const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647 }
  const techCount = nodeCount - groups
  while (edges.length < edgeCount) {
    const a = Math.floor(random() * techCount)
    const b = Math.floor(random() * techCount)
    if (a === b) continue
    edges.push(edge(`s${edges.length}`, `n${a}`, `n${b}`, undefined, random() > 0.7 ? "dashed" : "solid"))
  }
  return { version: 1, title: "Synthetic", nodes, edges }
}

export const samples = { hero, saas, monorepo }
