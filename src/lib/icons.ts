import * as SVGL from "@ridemountainpig/svgl-react"
import * as SI from "simple-icons"
import type { SimpleIcon } from "simple-icons"

export type BrandIcon = {
  title: string
  hex: string
  path: string
}

type SvgComponent = (props: React.SVGProps<SVGSVGElement>) => React.JSX.Element

/**
 * Build a slug → svgl component lookup by iterating over ALL exports. Brands
 * ship `Dark`/`Light` variants; both collapse onto the same slug with the
 * light variant preferred (svgl designs them for light surfaces, and our
 * cards are near-white in both themes).
 */
const svglBySlug: Record<string, SvgComponent> = {}
const svglRank = new Map<string, number>()
for (const [name, component] of Object.entries(SVGL)) {
  if (typeof component !== "function") continue
  const base = name.replace(/(Dark|Light)$/, "")
  const slug = base.toLowerCase()
  const rank = name.endsWith("Light") ? 0 : name === base ? 1 : 2
  if (rank < (svglRank.get(slug) ?? Number.POSITIVE_INFINITY)) {
    svglRank.set(slug, rank)
    svglBySlug[slug] = component as SvgComponent
  }
}

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
    if (svglBySlug[key]) return key
  }
  return null
}

export function getSvglIcon(slug: string): SvgComponent | null {
  const name = getSvglName(slug)
  return name ? svglBySlug[name] : null
}

/* ------------------------------------------------------------------ */
/* simple-icons fallback                                               */
/* ------------------------------------------------------------------ */

/**
 * Build a slug → SimpleIcon lookup by iterating over ALL exports.
 * Each SimpleIcon object carries its own `slug` field (matching the SVG filename),
 * so we don't need to guess export names.
 */
const bySlug: Record<string, SimpleIcon> = {}
for (const value of Object.values(SI)) {
  if (
    value &&
    typeof value === "object" &&
    "slug" in value &&
    "path" in value &&
    "hex" in value
  ) {
    bySlug[(value as SimpleIcon).slug] = value as SimpleIcon
  }
}

/**
 * Our catalog uses friendly slugs that sometimes differ from simple-icons slugs.
 * Map them here. Anything not listed is tried as-is.
 */
const slugAliases: Record<string, string> = {
  nextjs: "nextdotjs",
  vue: "vuedotjs",
  nuxt: "nuxtdotjs",
  node: "nodedotjs",
  java: "openjdk",
  csharp: "dotnet",
  cpp: "cplusplus",
  rails: "rubyonrails",
}

export function getBrandIcon(slug: string): BrandIcon | null {
  const siSlug = slugAliases[slug] ?? slug
  const icon = bySlug[siSlug]
  if (!icon) return null
  return {
    title: icon.title,
    hex: `#${icon.hex}`,
    path: icon.path,
  }
}
