import { NODE_HEIGHT, NODE_WIDTH, type AppEdge, type AppNode, type GraphDocument } from "./types"
import betterTStackDoc from "./cloudflare-edge-stack.json"
import { INK } from "./swatches"

type TechSpec = {
  id: string
  slug: string
  name: string
  subtitle: string
  category: string
  x: number
  y: number
  parentId?: string
  dark?: boolean
  iconPlate?: boolean
  /** Free-form context shown in the inspector when the node is selected. */
  note?: string
}

type FrameSpec = {
  id: string
  label: string
  color: string
  icon?: string
  dashed?: boolean
  x: number
  y: number
  w: number
  h: number
  parentId?: string
}

function frame(spec: FrameSpec): AppNode {
  return {
    id: spec.id,
    type: "group",
    position: { x: spec.x, y: spec.y },
    parentId: spec.parentId,
    data: {
      label: spec.label,
      color: spec.color,
      dashed: spec.dashed ?? false,
      icon: spec.icon,
    },
    width: spec.w,
    height: spec.h,
    style: { width: spec.w, height: spec.h },
  }
}

function tech(spec: TechSpec): AppNode {
  return {
    id: spec.id,
    type: "tech",
    position: { x: spec.x, y: spec.y },
    parentId: spec.parentId,
    data: {
      slug: spec.slug,
      name: spec.name,
      subtitle: spec.subtitle,
      category: spec.category,
      dark: spec.dark,
      iconPlate: spec.iconPlate,
      note: spec.note,
    },
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  }
}

function edge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string,
  data: AppEdge["data"] = { style: "solid" },
): AppEdge {
  return { id, source, sourceHandle, target, targetHandle, type: "tech", data }
}

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export type Template = {
  id: string
  name: string
  description: string
  build: () => GraphDocument
}

function betterTStack(): GraphDocument {
  // Same trust model as readJsonFile: the JSON was exported by this app.
  return { ...betterTStackDoc, title: "Better T Stack" } as GraphDocument
}

function vercelStack(): GraphDocument {
  const nodes: AppNode[] = [
    tech({
      id: "v_user",
      slug: "browser",
      name: "User",
      subtitle: "browser",
      category: "frontend",
      x: 40,
      y: 108,
    }),
    frame({
      id: "g_vercel",
      label: "Vercel",
      color: INK,
      icon: "vercel",
      x: 300,
      y: 20,
      w: 868,
      h: 400,
    }),
    tech({
      id: "v_edge",
      slug: "cdn",
      name: "Edge Network",
      subtitle: "cdn · isr cache",
      category: "hosting",
      parentId: "g_vercel",
      x: 24,
      y: 64,
      note: "Static assets and ISR HTML are served from the closest region; cache hits never reach a serverless function.",
    }),
    tech({
      id: "v_next",
      slug: "nextjs",
      name: "Next.js",
      subtitle: "app router",
      category: "frontend",
      dark: true,
      iconPlate: true,
      parentId: "g_vercel",
      x: 248,
      y: 64,
      note: "React Server Components stream from the nearest region. Client fetches go through route handlers, never straight to the database.",
    }),
    tech({
      id: "v_api",
      slug: "typescript",
      name: "Route handlers",
      subtitle: "api layer",
      category: "backend",
      parentId: "g_vercel",
      x: 472,
      y: 64,
      note: "Serverless functions — one deploy per commit, zero servers to patch.",
    }),
    tech({
      id: "v_prisma",
      slug: "prisma",
      name: "Prisma",
      subtitle: "orm",
      category: "database",
      dark: true,
      iconPlate: true,
      parentId: "g_vercel",
      x: 696,
      y: 64,
      note: "Uses the serverless driver so queries ride over HTTPS instead of holding TCP connections open.",
    }),
    tech({
      id: "v_kv",
      slug: "cache",
      name: "Vercel KV",
      subtitle: "edge storage",
      category: "database",
      parentId: "g_vercel",
      x: 472,
      y: 232,
    }),
    tech({
      id: "v_neon",
      slug: "neon",
      name: "Neon",
      subtitle: "serverless postgres",
      category: "database",
      x: 1268,
      y: 84,
      note: "Branches per preview deployment — every PR gets its own database copy.",
    }),
    tech({
      id: "v_upstash",
      slug: "upstash",
      name: "Upstash Redis",
      subtitle: "rate limiting",
      category: "database",
      dark: true,
      iconPlate: true,
      x: 1268,
      y: 252,
    }),
    tech({
      id: "v_clerk",
      slug: "clerk",
      name: "Clerk",
      subtitle: "edge auth",
      category: "auth",
      x: 340,
      y: 620,
      note: "Session verification runs in middleware at the edge before any function is invoked.",
    }),
    tech({
      id: "v_stripe",
      slug: "stripe",
      name: "Stripe",
      subtitle: "checkout · webhooks",
      category: "payment",
      x: 788,
      y: 620,
    }),
    tech({
      id: "v_gh",
      slug: "githubactions",
      name: "GitHub Actions",
      subtitle: "ci · cd",
      category: "devops",
      x: 40,
      y: 620,
      note: "Typecheck, lint and Playwright e2e run per PR; merges to main promote straight to production.",
    }),
  ]

  const edges: AppEdge[] = [
    edge("ve1", "v_user", "right", "v_edge", "left", { label: "HTTPS", style: "solid" }),
    edge("ve2", "v_edge", "right", "v_next", "left"),
    edge("ve3", "v_next", "right", "v_api", "left"),
    edge("ve4", "v_api", "right", "v_prisma", "left"),
    edge("ve5", "v_prisma", "right", "v_neon", "left", { label: "SQL", style: "solid" }),
    edge("ve6", "v_api", "bottom", "v_kv", "top"),
    edge("ve7", "v_api", "bottom", "v_upstash", "left", {
      label: "rate limit",
      style: "dashed",
      sourcePoint: { x: 0.75, y: 1 },
    }),
    edge("ve8", "v_edge", "bottom", "v_clerk", "top", { label: "session", style: "dashed" }),
    edge("ve9", "v_next", "bottom", "v_stripe", "top", { label: "checkout", style: "solid" }),
    edge("ve10", "v_gh", "right", "g_vercel", "left", { label: "deploy on push", style: "dashed" }),
  ]

  return { version: 1, title: "Next.js on Vercel", nodes, edges }
}

function microservices(): GraphDocument {
  const nodes: AppNode[] = [
    tech({
      id: "m_user",
      slug: "browser",
      name: "Client",
      subtitle: "web / mobile",
      category: "frontend",
      x: 40,
      y: 292,
    }),
    frame({
      id: "g_k8s",
      label: "Kubernetes cluster",
      color: "#326ce5",
      icon: "kubernetes",
      x: 300,
      y: 60,
      w: 704,
      h: 560,
    }),
    tech({
      id: "m_gw",
      slug: "nginx",
      name: "API gateway",
      subtitle: "ingress",
      category: "devops",
      parentId: "g_k8s",
      x: 32,
      y: 232,
      note: "Terminates TLS, rate-limits per tenant and routes on path prefixes.",
    }),
    tech({
      id: "m_orders",
      slug: "go",
      name: "Orders",
      subtitle: "service",
      category: "backend",
      parentId: "g_k8s",
      x: 280,
      y: 64,
    }),
    tech({
      id: "m_billing",
      slug: "rust",
      name: "Billing",
      subtitle: "service",
      category: "backend",
      dark: true,
      iconPlate: true,
      parentId: "g_k8s",
      x: 280,
      y: 232,
    }),
    tech({
      id: "m_search",
      slug: "python",
      name: "Search",
      subtitle: "service",
      category: "backend",
      parentId: "g_k8s",
      x: 280,
      y: 400,
    }),
    tech({
      id: "m_pg",
      slug: "postgresql",
      name: "PostgreSQL",
      subtitle: "primary db",
      category: "database",
      parentId: "g_k8s",
      x: 528,
      y: 64,
      note: "One database per service — only Orders holds schema access here.",
    }),
    tech({
      id: "m_kafka",
      slug: "apachekafka",
      name: "Kafka",
      subtitle: "event bus",
      category: "backend",
      dark: true,
      iconPlate: true,
      parentId: "g_k8s",
      x: 528,
      y: 232,
      note: "Topics keyed by order id so per-order processing stays ordered.",
    }),
    tech({
      id: "m_prom",
      slug: "prometheus",
      name: "Prometheus",
      subtitle: "metrics",
      category: "monitoring",
      x: 1128,
      y: 60,
    }),
    tech({
      id: "m_es",
      slug: "elasticsearch",
      name: "Elasticsearch",
      subtitle: "search index",
      category: "database",
      x: 1128,
      y: 560,
    }),
    tech({
      id: "m_gh",
      slug: "githubactions",
      name: "GitHub Actions",
      subtitle: "ci · cd",
      category: "devops",
      x: 40,
      y: 740,
    }),
    tech({
      id: "m_reg",
      slug: "docker",
      name: "GHCR",
      subtitle: "image registry",
      category: "hosting",
      x: 340,
      y: 740,
    }),
    tech({
      id: "m_grafana",
      slug: "grafana",
      name: "Grafana",
      subtitle: "dashboards",
      category: "monitoring",
      dark: true,
      iconPlate: true,
      x: 788,
      y: 740,
    }),
  ]

  const edges: AppEdge[] = [
    edge("me1", "m_user", "right", "m_gw", "left", { label: "HTTPS", style: "solid" }),
    edge("me2", "m_gw", "right", "m_orders", "left"),
    edge("me3", "m_gw", "right", "m_billing", "left"),
    edge("me4", "m_gw", "right", "m_search", "left"),
    edge("me5", "m_orders", "right", "m_pg", "left", { label: "SQL", style: "solid" }),
    edge("me6", "m_orders", "right", "m_kafka", "left", {
      label: "events",
      style: "dashed",
      sourcePoint: { x: 1, y: 0.2 },
    }),
    edge("me7", "m_billing", "right", "m_kafka", "left", {
      label: "payments",
      style: "dashed",
      targetPoint: { x: 0, y: 0.8 },
    }),
    edge("me8", "m_kafka", "bottom", "m_search", "right", {
      label: "index",
      style: "dashed",
      sourcePoint: { x: 0, y: 1 },
      targetPoint: { x: 1, y: 0.5 },
    }),
    edge("me9", "m_search", "right", "m_es", "left", {
      label: "queries",
      style: "solid",
      sourcePoint: { x: 1, y: 0.15 },
    }),
    edge("me10", "g_k8s", "right", "m_prom", "left", { label: "scrape", style: "dashed" }),
    edge("me11", "m_prom", "bottom", "m_grafana", "top", {
      label: "query",
      style: "solid",
      sourcePoint: { x: 0, y: 1 },
    }),
    edge("me12", "m_gh", "right", "m_reg", "left", { label: "build · push", style: "solid" }),
    edge("me13", "m_reg", "top", "g_k8s", "bottom", { label: "rollout", style: "dashed" }),
  ]

  return { version: 1, title: "Microservices on Kubernetes", nodes, edges }
}

function dataPipeline(): GraphDocument {
  const nodes: AppNode[] = [
    frame({
      id: "g_src",
      label: "Sources",
      color: "#64748b",
      x: 60,
      y: 40,
      w: 668,
      h: 216,
    }),
    tech({
      id: "d_web",
      slug: "react",
      name: "Web app",
      subtitle: "events",
      category: "frontend",
      parentId: "g_src",
      x: 24,
      y: 56,
    }),
    tech({
      id: "d_mobile",
      slug: "mobile",
      name: "Mobile app",
      subtitle: "events",
      category: "generic",
      parentId: "g_src",
      x: 248,
      y: 56,
    }),
    tech({
      id: "d_posthog",
      slug: "posthog",
      name: "PostHog",
      subtitle: "autocapture",
      category: "monitoring",
      parentId: "g_src",
      x: 472,
      y: 56,
      note: "Product analytics events join the same stream so funnels and warehouse views always agree.",
    }),
    tech({
      id: "d_kafka",
      slug: "apachekafka",
      name: "Kafka",
      subtitle: "event stream",
      category: "backend",
      dark: true,
      iconPlate: true,
      x: 320,
      y: 330,
      note: "Single ingest topic partitioned by tenant id; replayable for seven days.",
    }),
    tech({
      id: "d_spark",
      slug: "apachespark",
      name: "Spark",
      subtitle: "streaming etl",
      category: "backend",
      x: 320,
      y: 560,
    }),
    tech({
      id: "d_lake",
      slug: "bucket",
      name: "Data lake",
      subtitle: "raw zone",
      category: "generic",
      x: 96,
      y: 790,
      note: "Immutable raw events in open table format — reprocess whenever the model changes.",
    }),
    tech({
      id: "d_wh",
      slug: "snowflake",
      name: "Snowflake",
      subtitle: "warehouse",
      category: "database",
      dark: true,
      iconPlate: true,
      x: 544,
      y: 790,
    }),
    tech({
      id: "d_bi",
      slug: "grafana",
      name: "Dashboards",
      subtitle: "bi",
      category: "monitoring",
      dark: true,
      iconPlate: true,
      x: 320,
      y: 1020,
    }),
    tech({
      id: "d_api",
      slug: "graphql",
      name: "Metrics API",
      subtitle: "serving layer",
      category: "backend",
      x: 544,
      y: 1020,
    }),
    tech({
      id: "d_airflow",
      slug: "apacheairflow",
      name: "Airflow",
      subtitle: "orchestration",
      category: "devops",
      dark: true,
      iconPlate: true,
      x: 888,
      y: 560,
      note: "DAGs own every schedule — backfills and retries never live in application code.",
    }),
  ]

  const edges: AppEdge[] = [
    edge("de1", "d_web", "bottom", "d_kafka", "top", {
      style: "solid",
      targetPoint: { x: 0.2, y: 0 },
    }),
    edge("de2", "d_mobile", "bottom", "d_kafka", "top", {
      label: "events",
      style: "solid",
      targetPoint: { x: 0.5, y: 0 },
    }),
    edge("de3", "d_posthog", "bottom", "d_kafka", "top", {
      style: "solid",
      targetPoint: { x: 0.8, y: 0 },
    }),
    edge("de4", "d_kafka", "bottom", "d_spark", "top"),
    edge("de5", "d_spark", "bottom", "d_lake", "top", { label: "raw files", style: "dashed" }),
    edge("de6", "d_spark", "bottom", "d_wh", "top", {
      label: "curated tables",
      style: "solid",
      sourcePoint: { x: 1, y: 1 },
    }),
    edge("de7", "d_wh", "bottom", "d_bi", "top", { label: "sql", style: "solid" }),
    edge("de8", "d_wh", "bottom", "d_api", "top", {
      label: "serve",
      style: "solid",
      sourcePoint: { x: 1, y: 1 },
    }),
    edge("de9", "d_airflow", "left", "d_spark", "right", { label: "orchestrates", style: "dashed" }),
    edge("de10", "d_airflow", "top", "d_kafka", "right", {
      label: "schedules",
      style: "dashed",
      sourcePoint: { x: 0.2, y: 0 },
    }),
  ]

  return { version: 1, title: "Streaming data pipeline", nodes, edges }
}

function aiAssistant(): GraphDocument {
  const nodes: AppNode[] = [
    frame({
      id: "g_kb",
      label: "Knowledge pipeline",
      color: "#d946ef",
      dashed: true,
      x: 56,
      y: 8,
      w: 504,
      h: 204,
    }),
    tech({
      id: "a_git",
      slug: "github",
      name: "GitHub",
      subtitle: "docs repo",
      category: "tooling",
      parentId: "g_kb",
      x: 40,
      y: 32,
    }),
    tech({
      id: "a_ingest",
      slug: "fastapi",
      name: "Ingestion",
      subtitle: "chunk · embed",
      category: "backend",
      parentId: "g_kb",
      x: 316,
      y: 32,
      note: "Re-runs on every docs merge — markdown is split into ~800 token chunks with overlap.",
    }),
    tech({
      id: "a_openai",
      slug: "openai",
      name: "OpenAI",
      subtitle: "gpt · embeddings",
      category: "ai",
      dark: true,
      iconPlate: true,
      x: 892,
      y: 40,
      note: "One model family for both chat and text-embedding-3-large retrieval vectors.",
    }),
    tech({
      id: "a_user",
      slug: "browser",
      name: "User",
      subtitle: "chat ui",
      category: "frontend",
      x: 40,
      y: 328,
    }),
    frame({
      id: "g_app",
      label: "Product app",
      color: INK,
      icon: "nextjs",
      x: 284,
      y: 288,
      w: 512,
      h: 200,
    }),
    tech({
      id: "a_ui",
      slug: "nextjs",
      name: "Chat UI",
      subtitle: "streaming ssr",
      category: "frontend",
      parentId: "g_app",
      x: 40,
      y: 40,
    }),
    tech({
      id: "a_agent",
      slug: "langchain",
      name: "LangGraph",
      subtitle: "agent runtime",
      category: "ai",
      dark: true,
      iconPlate: true,
      parentId: "g_app",
      x: 324,
      y: 40,
      note: "Runs the retrieve-then-answer loop; tools can search orders and escalate to a human.",
    }),
    tech({
      id: "a_hist",
      slug: "supabase",
      name: "Supabase",
      subtitle: "auth · history",
      category: "backend",
      x: 372,
      y: 616,
      note: "Row level security scopes every conversation to its owner.",
    }),
    tech({
      id: "a_vec",
      slug: "qdrant",
      name: "Qdrant",
      subtitle: "vector search",
      category: "database",
      x: 820,
      y: 616,
    }),
  ]

  const edges: AppEdge[] = [
    edge("ae1", "a_git", "right", "a_ingest", "left", { label: "sync", style: "dashed" }),
    edge("ae2", "a_ingest", "right", "a_openai", "left", { label: "embed", style: "solid" }),
    edge("ae3", "a_openai", "bottom", "a_vec", "top", {
      label: "upsert",
      style: "dashed",
      sourcePoint: { x: 0.15, y: 1 },
    }),
    edge("ae4", "a_user", "right", "a_ui", "left", { label: "HTTPS", style: "solid" }),
    edge("ae5", "a_ui", "right", "a_agent", "left"),
    edge("ae6", "a_agent", "right", "a_openai", "bottom", {
      label: "prompt",
      style: "solid",
      sourcePoint: { x: 1, y: 0.5 },
    }),
    edge("ae7", "a_agent", "bottom", "a_vec", "left", {
      label: "retrieve",
      style: "solid",
      targetPoint: { x: 0, y: 0.3 },
    }),
    edge("ae8", "a_ui", "bottom", "a_hist", "top", { label: "auth · history", style: "solid" }),
  ]

  return { version: 1, title: "AI assistant with RAG", nodes, edges }
}

function headlessCommerce(): GraphDocument {
  const nodes: AppNode[] = [
    tech({
      id: "e_user",
      slug: "browser",
      name: "Customer",
      subtitle: "browser",
      category: "frontend",
      x: 40,
      y: 208,
    }),
    frame({
      id: "g_commerce",
      label: "Commerce core",
      color: INK,
      icon: "shopify",
      x: 260,
      y: 168,
      w: 512,
      h: 200,
    }),
    tech({
      id: "e_store",
      slug: "nextjs",
      name: "Storefront",
      subtitle: "hydrogen",
      category: "frontend",
      dark: true,
      iconPlate: true,
      parentId: "g_commerce",
      x: 40,
      y: 40,
      note: "Server components cache catalogue pages; the cart is the only fully dynamic surface.",
    }),
    tech({
      id: "e_api",
      slug: "shopify",
      name: "Shopify",
      subtitle: "storefront api",
      category: "payment",
      parentId: "g_commerce",
      x: 324,
      y: 40,
    }),
    tech({
      id: "e_admin",
      slug: "sanity",
      name: "Sanity CMS",
      subtitle: "content",
      category: "design",
      x: 300,
      y: 472,
      note: "Editors publish landing content here; revalidation webhooks refresh the storefront.",
    }),
    tech({
      id: "e_posthog",
      slug: "posthog",
      name: "PostHog",
      subtitle: "funnels",
      category: "monitoring",
      x: 40,
      y: 472,
    }),
    tech({
      id: "e_mail",
      slug: "resend",
      name: "Resend",
      subtitle: "order email",
      category: "payment",
      x: 532,
      y: 472,
    }),
    tech({
      id: "e_stripe",
      slug: "stripe",
      name: "Stripe",
      subtitle: "payments",
      category: "payment",
      x: 854,
      y: 84,
    }),
    tech({
      id: "e_algolia",
      slug: "algolia",
      name: "Algolia",
      subtitle: "search",
      category: "database",
      dark: true,
      iconPlate: true,
      x: 854,
      y: 332,
    }),
    tech({
      id: "e_cloud",
      slug: "cloudinary",
      name: "Cloudinary",
      subtitle: "media cdn",
      category: "media",
      dark: true,
      iconPlate: true,
      x: 854,
      y: 580,
    }),
  ]

  const edges: AppEdge[] = [
    edge("ee1", "e_user", "right", "e_store", "left", { label: "HTTPS", style: "solid" }),
    edge("ee2", "e_store", "right", "e_api", "left"),
    edge("ee3", "e_api", "right", "e_stripe", "left", { label: "payments", style: "solid" }),
    edge("ee4", "e_api", "right", "e_algolia", "left", { label: "search", style: "solid" }),
    edge("ee5", "e_api", "bottom", "e_mail", "top", { label: "receipts", style: "dashed" }),
    edge("ee6", "e_api", "bottom", "e_cloud", "left", {
      label: "media",
      style: "dashed",
      sourcePoint: { x: 0.9, y: 1 },
      targetPoint: { x: 0, y: 0.8 },
    }),
    edge("ee7", "e_admin", "top", "e_store", "bottom", { label: "content", style: "dashed" }),
    edge("ee8", "e_user", "bottom", "e_posthog", "top", { label: "analytics", style: "dashed" }),
  ]

  return { version: 1, title: "Headless commerce", nodes, edges }
}

export const templates: Template[] = [
  {
    id: "edge-stack",
    name: "Better T Stack",
    description: "TanStack Start, Hono, Drizzle and D1 on Workers",
    build: betterTStack,
  },
  {
    id: "vercel-stack",
    name: "Next.js on Vercel",
    description: "Edge network, KV, Neon, Clerk, Stripe and CI deploys",
    build: vercelStack,
  },
  {
    id: "microservices",
    name: "Microservices on Kubernetes",
    description: "Gateway fan-out, Kafka bus, search index and CI rollout",
    build: microservices,
  },
  {
    id: "data-pipeline",
    name: "Analytics pipeline",
    description: "Sources into Kafka and Spark, landing in lake and warehouse",
    build: dataPipeline,
  },
  {
    id: "ai-assistant",
    name: "AI assistant",
    description: "RAG chat with LangGraph, Qdrant vectors and OpenAI",
    build: aiAssistant,
  },
  {
    id: "headless-commerce",
    name: "Headless commerce",
    description: "Shopify storefront with CMS content, search and payments",
    build: headlessCommerce,
  },
]

/** The document loaded the first time somebody opens the editor. */
export function loadStarterDoc(): GraphDocument {
  return betterTStack()
}
