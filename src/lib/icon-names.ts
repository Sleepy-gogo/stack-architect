import { svglExportNames } from "./icon-names-generated.js"

const svglNames = new Set(svglExportNames)

/** Catalog slugs that differ from the normalized svgl name. */
const svglAliases: Record<string, string> = {
  node: "nodejs",
  cpp: "cplusplus",
  csharp: "microsoftnet",
  rails: "rubyonrails",
  orpc: "trpc",
  drizzle: "drizzleorm",
  mui: "materialui",
  threedotjs: "threejs",
  d3: "d3js",
  greensock: "gsap",
  express: "expressjs",
  springboot: "spring",
  apacheairflow: "airflow",
  apachespark: "spark",
  elasticsearch: "elastic",
}

/**
 * Resolve a catalog slug to the key it looks up in `svglBySlug`, or null when
 * neither the slug nor an alias matches an svgl export.
 */
export function getSvglName(slug: string): string | null {
  const candidates = [slug, svglAliases[slug]]
  for (const candidate of candidates) {
    if (!candidate) continue
    const key = candidate.toLowerCase()
    if (svglNames.has(key)) return key
  }
  return null
}

