import { getSvglName } from "./icons"
import { generatedTechItems } from "./catalog-generated"
import type { TechCategoryId, TechItem } from "./types"

export const categories: { id: TechCategoryId; label: string; color: string }[] =
  [
    { id: "generic", label: "Building blocks", color: "#64748b" },
    { id: "frontend", label: "Frontend", color: "#3b82f6" },
    { id: "backend", label: "Backend", color: "#22c55e" },
    { id: "database", label: "Databases", color: "#a855f7" },
    { id: "hosting", label: "Cloud & hosting", color: "#f97316" },
    { id: "devops", label: "DevOps", color: "#06b6d4" },
    { id: "auth", label: "Auth & security", color: "#ec4899" },
    { id: "language", label: "Languages", color: "#eab308" },
    { id: "tooling", label: "Tooling & testing", color: "#64748b" },
    { id: "editors", label: "Editors, IDEs & terminals", color: "#84cc16" },
    { id: "monitoring", label: "Monitoring & analytics", color: "#ef4444" },
    { id: "design", label: "Design", color: "#8b5cf6" },
    { id: "ai", label: "AI", color: "#d946ef" },
    { id: "payment", label: "Payments & commerce", color: "#14b8a6" },
    { id: "crypto", label: "Crypto", color: "#f59e0b" },
    { id: "media", label: "Media & streaming", color: "#f43f5e" },
    { id: "social", label: "Social & community", color: "#f472b6" },
    { id: "gaming", label: "Games & game dev", color: "#e11d48" },
    { id: "productivity", label: "Productivity & docs", color: "#4f46e5" },
    { id: "browsers", label: "Browsers", color: "#0ea5e9" },
    { id: "software", label: "Apps & services", color: "#94a3b8" },
  ]

export const categoryMap = Object.fromEntries(
  categories.map((c) => [c.id, c]),
) as Record<TechCategoryId, (typeof categories)[number]>

const curatedCatalog: TechItem[] = [
  // Generic building blocks — drawn from Lucide, not a brand set
  { slug: "browser", name: "User", subtitle: "browser", category: "generic", keywords: "person client desktop monitor" },
  { slug: "mobile", name: "Mobile app", subtitle: "ios / android", category: "generic", keywords: "phone device client" },
  { slug: "service", name: "Service", subtitle: "http api", category: "generic", keywords: "server backend box" },
  { slug: "datastore", name: "Data store", subtitle: "database", category: "generic", keywords: "db storage disk" },
  { slug: "queue", name: "Queue", subtitle: "message broker", category: "generic", keywords: "events bus stream" },
  { slug: "cache", name: "Cache", subtitle: "key / value", category: "generic", keywords: "memory redis layer" },
  { slug: "cdn", name: "CDN", subtitle: "edge cache", category: "generic", keywords: "network edge" },
  { slug: "cron", name: "Scheduler", subtitle: "cron jobs", category: "generic", keywords: "timer background worker" },
  { slug: "bucket", name: "Object storage", subtitle: "blobs / files", category: "generic", keywords: "s3 bucket upload" },
  { slug: "thirdparty", name: "Third party", subtitle: "external api", category: "generic", keywords: "integration vendor" },

  // Frontend frameworks
  { slug: "react", name: "React", subtitle: "ui library", category: "frontend" },
  { slug: "tanstack", name: "TanStack Start", subtitle: "full-stack react", category: "frontend" },
  { slug: "nextjs", name: "Next.js", subtitle: "react framework", category: "frontend" },
  { slug: "remix", name: "Remix", subtitle: "web framework", category: "frontend" },
  { slug: "vue", name: "Vue", subtitle: "ui framework", category: "frontend" },
  { slug: "nuxt", name: "Nuxt", subtitle: "vue framework", category: "frontend" },
  { slug: "svelte", name: "Svelte", subtitle: "ui framework", category: "frontend" },
  { slug: "angular", name: "Angular", subtitle: "web framework", category: "frontend" },
  { slug: "astro", name: "Astro", subtitle: "content sites", category: "frontend" },
  { slug: "qwik", name: "Qwik", subtitle: "resumable apps", category: "frontend" },
  { slug: "expo", name: "Expo", subtitle: "react native", category: "frontend" },
  { slug: "flutter", name: "Flutter", subtitle: "cross-platform", category: "frontend" },

  // Frontend tooling / styling
  { slug: "vite", name: "Vite", subtitle: "bundler / dev server", category: "frontend" },
  { slug: "tailwindcss", name: "Tailwind CSS", subtitle: "utility css", category: "frontend" },
  { slug: "bootstrap", name: "Bootstrap", subtitle: "css framework", category: "frontend" },
  { slug: "mui", name: "MUI", subtitle: "component lib", category: "frontend" },
  { slug: "storybook", name: "Storybook", subtitle: "component dev", category: "frontend" },
  { slug: "threedotjs", name: "Three.js", subtitle: "3d graphics", category: "frontend" },
  { slug: "d3", name: "D3.js", subtitle: "data viz", category: "frontend" },
  { slug: "framer", name: "Framer Motion", subtitle: "animation", category: "frontend" },
  { slug: "greensock", name: "GSAP", subtitle: "animation", category: "frontend" },

  // Backend frameworks
  { slug: "node", name: "Node.js", subtitle: "js runtime", category: "backend" },
  { slug: "orpc", name: "oRPC", subtitle: "type-safe rpc", category: "backend" },
  { slug: "bun", name: "Bun", subtitle: "js runtime", category: "backend" },
  { slug: "deno", name: "Deno", subtitle: "js runtime", category: "backend" },
  { slug: "express", name: "Express", subtitle: "http server", category: "backend" },
  { slug: "hono", name: "Hono", subtitle: "http server", category: "backend" },
  { slug: "fastify", name: "Fastify", subtitle: "http server", category: "backend" },
  { slug: "nestjs", name: "NestJS", subtitle: "node framework", category: "backend" },
  { slug: "laravel", name: "Laravel", subtitle: "php framework", category: "backend" },
  { slug: "django", name: "Django", subtitle: "python framework", category: "backend" },
  { slug: "fastapi", name: "FastAPI", subtitle: "python api", category: "backend" },
  { slug: "flask", name: "Flask", subtitle: "python framework", category: "backend" },
  { slug: "rails", name: "Ruby on Rails", subtitle: "ruby framework", category: "backend" },
  { slug: "phoenix", name: "Phoenix", subtitle: "elixir framework", category: "backend" },
  { slug: "springboot", name: "Spring Boot", subtitle: "java framework", category: "backend" },
  { slug: "gin", name: "Gin", subtitle: "go framework", category: "backend" },
  { slug: "supabase", name: "Supabase", subtitle: "backend platform", category: "backend" },
  { slug: "graphql", name: "GraphQL", subtitle: "query language", category: "backend" },
  { slug: "apollo", name: "Apollo", subtitle: "graphql client", category: "backend" },
  { slug: "apachekafka", name: "Kafka", subtitle: "event stream", category: "backend" },
  { slug: "apachespark", name: "Spark", subtitle: "batch / stream", category: "backend" },
  { slug: "rabbitmq", name: "RabbitMQ", subtitle: "message broker", category: "backend" },

  // Databases
  { slug: "postgresql", name: "PostgreSQL", subtitle: "relational db", category: "database" },
  { slug: "mysql", name: "MySQL", subtitle: "relational db", category: "database" },
  { slug: "sqlite", name: "SQLite", subtitle: "embedded db", category: "database" },
  { slug: "mongodb", name: "MongoDB", subtitle: "document db", category: "database" },
  { slug: "redis", name: "Redis", subtitle: "in-memory store", category: "database" },
  { slug: "planetscale", name: "PlanetScale", subtitle: "mysql platform", category: "database" },
  { slug: "neon", name: "Neon", subtitle: "pg platform", category: "database" },
  { slug: "turso", name: "Turso", subtitle: "sqlite edge", category: "database" },
  { slug: "prisma", name: "Prisma", subtitle: "orm", category: "database" },
  { slug: "drizzle", name: "Drizzle ORM", subtitle: "orm", category: "database" },
  { slug: "snowflake", name: "Snowflake", subtitle: "warehouse", category: "database" },
  { slug: "clickhouse", name: "ClickHouse", subtitle: "olap db", category: "database" },
  { slug: "elasticsearch", name: "Elasticsearch", subtitle: "search index", category: "database" },

  // Hosting / deployment
  { slug: "vercel", name: "Vercel", subtitle: "deploy platform", category: "hosting" },
  { slug: "cloudflare", name: "Cloudflare", subtitle: "edge network", category: "hosting" },
  { slug: "netlify", name: "Netlify", subtitle: "deploy platform", category: "hosting" },
  { slug: "railway", name: "Railway", subtitle: "deploy platform", category: "hosting" },
  { slug: "fly", name: "Fly.io", subtitle: "app platform", category: "hosting" },
  { slug: "render", name: "Render", subtitle: "app platform", category: "hosting" },
  { slug: "docker", name: "Docker", subtitle: "containers", category: "hosting" },
  { slug: "kubernetes", name: "Kubernetes", subtitle: "orchestration", category: "hosting" },

  // DevOps / CI-CD
  { slug: "githubactions", name: "GitHub Actions", subtitle: "ci/cd", category: "devops" },
  { slug: "gitlab", name: "GitLab CI", subtitle: "ci/cd", category: "devops" },
  { slug: "circleci", name: "CircleCI", subtitle: "ci/cd", category: "devops" },
  { slug: "terraform", name: "Terraform", subtitle: "iac", category: "devops" },
  { slug: "ansible", name: "Ansible", subtitle: "automation", category: "devops" },
  { slug: "vault", name: "Vault", subtitle: "secrets mgmt", category: "devops" },
  { slug: "nginx", name: "NGINX", subtitle: "proxy / ingress", category: "devops" },
  { slug: "apacheairflow", name: "Airflow", subtitle: "orchestration", category: "devops" },

  // Auth
  { slug: "auth0", name: "Auth0", subtitle: "auth service", category: "auth" },
  { slug: "clerk", name: "Clerk", subtitle: "auth service", category: "auth" },
  { slug: "keycloak", name: "Keycloak", subtitle: "auth server", category: "auth" },
  { slug: "betterauth", name: "better-auth", subtitle: "authentication", category: "auth" },

  // Languages
  { slug: "typescript", name: "TypeScript", subtitle: "language", category: "language" },
  { slug: "javascript", name: "JavaScript", subtitle: "language", category: "language" },
  { slug: "python", name: "Python", subtitle: "language", category: "language" },
  { slug: "go", name: "Go", subtitle: "language", category: "language" },
  { slug: "rust", name: "Rust", subtitle: "language", category: "language" },
  { slug: "php", name: "PHP", subtitle: "language", category: "language" },
  { slug: "ruby", name: "Ruby", subtitle: "language", category: "language" },
  { slug: "kotlin", name: "Kotlin", subtitle: "language", category: "language" },
  { slug: "swift", name: "Swift", subtitle: "language", category: "language" },
  { slug: "java", name: "Java", subtitle: "language", category: "language" },
  { slug: "cpp", name: "C++", subtitle: "language", category: "language" },
  { slug: "csharp", name: "C# / .NET", subtitle: "language", category: "language" },
  { slug: "elixir", name: "Elixir", subtitle: "language", category: "language" },
  { slug: "haskell", name: "Haskell", subtitle: "language", category: "language" },
  { slug: "zig", name: "Zig", subtitle: "language", category: "language" },

  // Tooling / testing / linting
  { slug: "vitest", name: "Vitest", subtitle: "test runner", category: "tooling" },
  { slug: "jest", name: "Jest", subtitle: "test runner", category: "tooling" },
  { slug: "playwright", name: "Playwright", subtitle: "e2e testing", category: "tooling" },
  { slug: "cypress", name: "Cypress", subtitle: "e2e testing", category: "tooling" },
  { slug: "eslint", name: "ESLint", subtitle: "linter", category: "tooling" },
  { slug: "prettier", name: "Prettier", subtitle: "formatter", category: "tooling" },
  { slug: "biome", name: "Biome", subtitle: "linter / formatter", category: "tooling" },
  { slug: "oxc", name: "oxlint / oxfmt", subtitle: "lint / format", category: "tooling" },
  { slug: "turborepo", name: "Turborepo", subtitle: "build system", category: "tooling" },
  { slug: "github", name: "GitHub", subtitle: "git hosting", category: "tooling" },
  { slug: "git", name: "Git", subtitle: "version control", category: "tooling" },
  { slug: "bitbucket", name: "Bitbucket", subtitle: "git hosting", category: "tooling" },

  // Monitoring
  { slug: "prometheus", name: "Prometheus", subtitle: "metrics", category: "monitoring" },
  { slug: "grafana", name: "Grafana", subtitle: "dashboards", category: "monitoring" },
  { slug: "sentry", name: "Sentry", subtitle: "error tracking", category: "monitoring" },
  { slug: "datadog", name: "Datadog", subtitle: "observability", category: "monitoring" },
  { slug: "posthog", name: "PostHog", subtitle: "product analytics", category: "monitoring" },

  // Design
  { slug: "figma", name: "Figma", subtitle: "design tool", category: "design" },
  { slug: "webflow", name: "Webflow", subtitle: "no-code builder", category: "design" },

  // Payments / services
  { slug: "stripe", name: "Stripe", subtitle: "payments", category: "payment" },
  { slug: "cloudinary", name: "Cloudinary", subtitle: "media cdn", category: "payment" },
  { slug: "resend", name: "Resend", subtitle: "email api", category: "payment" },
  { slug: "twilio", name: "Twilio", subtitle: "sms / voice", category: "payment" },
]

/**
 * The generated svgl catalog fills every section out to the full icon set.
 * Curated entries win: a generated item is dropped when its icon resolves to
 * the same svgl component as a curated one (e.g. curated "nextjs" and
 * generated "nextjs", or curated generic blocks that shadow an svgl export).
 */
const curatedSvglNames = new Set(
  curatedCatalog
    .map((item) => getSvglName(item.slug))
    .filter((name): name is string => name !== null),
)
const curatedSlugs = new Set(curatedCatalog.map((item) => item.slug))

export const techCatalog: TechItem[] = [
  ...curatedCatalog,
  ...generatedTechItems.filter(
    (item) =>
      !curatedSlugs.has(item.slug) &&
      !curatedSvglNames.has(getSvglName(item.slug) ?? item.slug),
  ),
]
