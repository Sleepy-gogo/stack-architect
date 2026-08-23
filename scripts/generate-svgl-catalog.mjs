/**
 * Generates src/lib/catalog-generated.ts: a TechItem for every icon component
 * shipped by @ridemountainpig/svgl-react.
 *
 * Metadata (display title, categories, brand URL) comes from the public svgl
 * API (https://api.svgl.app), matched to components via normalized names.
 * Entries the API doesn't know about fall back to a humanized component name
 * and the generic "software" category.
 *
 * Re-run after bumping @ridemountainpig/svgl-react:
 *   node scripts/generate-svgl-catalog.mjs
 */
import { createRequire } from "node:module"
import { writeFile } from "node:fs/promises"
import {
  categoryOverrides,
  droppedSlugs,
  nameOverrides,
  subtitleOverrides,
} from "./svgl-catalog-overrides.mjs"

const require = createRequire(import.meta.url)
const SVGL = require("@ridemountainpig/svgl-react")

const OUT_FILE = new URL("../src/lib/catalog-generated.ts", import.meta.url)

/** Mirrors icons.ts: collapse Dark/Light variants onto one slug, light preferred. */
function collectIcons() {
  const rankOf = (name, base) => (name.endsWith("Light") ? 0 : name === base ? 1 : 2)
  const best = new Map()
  for (const [name, value] of Object.entries(SVGL)) {
    if (typeof value !== "function" || name.endsWith("Url")) continue
    const base = name.replace(/(Dark|Light)$/, "")
    const rank = rankOf(name, base)
    if (rank < (best.get(base)?.rank ?? Number.POSITIVE_INFINITY)) {
      best.set(base, { base, exportName: name, rank })
    }
  }
  return [...best.values()]
}

const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

/** Route basename minus variant/wordmark decorations → match key. */
function routeKeys(route) {
  if (!route) return []
  const routes = typeof route === "string" ? [route] : Object.values(route)
  return routes.map((r) => {
    const file = r.split("/").pop() ?? ""
    return normalize(
      file
        .replace(/\.svg$/, "")
        .replace(/-(wordmark|logo|icon|symbol|light|dark)/g, "")
    )
  })
}

async function fetchApiEntries() {
  const res = await fetch("https://api.svgl.app")
  if (!res.ok) throw new Error(`api.svgl.app responded ${res.status}`)
  return res.json()
}

/**
 * svgl's free-form category tags mapped onto the editor's fixed palette
 * sections. Rules are checked in order, so the first matching rule wins no
 * matter where the tag appears in an entry's list. The bulk of real
 * categorization lives in svgl-catalog-overrides.mjs — these rules only catch
 * new icons added to svgl after the last review pass.
 */
const categoryRules = [
  [/^(language)$/, "language"],
  [/^(database|syncengine)$/, "database"],
  [/^(authentication|cybersecurity|privacy|secrets|captcha)$/, "auth"],
  [/^crypto$/, "crypto"],
  [/^(payment|marketplace|ecommerce)$/, "payment"],
  [/^(analytics)$/, "monitoring"],
  [/^(ai)$/, "ai"],
  [/^(hosting|platform)$/, "hosting"],
  [/^(devtool|config|monorepo|iac|automation|iot)$/, "devops"],
  [/^(compiler|framework|library|nuxt|voidzero|vercel)$/, "frontend"],
  [/^(design|themes)$/, "design"],
  [/^cms$/, "backend"],
  [/^(browser)$/, "browsers"],
  [/^(music|entertainment)$/, "media"],
  [/^(social|community)$/, "social"],
]

function mapCategory(tags) {
  for (const [pattern, category] of categoryRules) {
    if (tags.some((t) => pattern.test(t))) return category
  }
  return "software"
}

function subtitleFor(url, tags) {
  if (url) {
    try {
      const host = new URL(url).hostname.replace(/^www\./, "")
      if (host && host !== "github.com" && host !== "en.wikipedia.org") return host
    } catch {
      /* keep fallback */
    }
  }
  return tags[0] ?? "service"
}

const humanize = (base) => base.replace(/([a-z0-9])([A-Z])/g, "$1 $2")

function buildItem(icon, apiEntry) {
  const rawTags = [apiEntry?.category ?? []].flat(3)
  const tags = rawTags.map(normalize).filter(Boolean)
  const url = apiEntry?.url
  const name = apiEntry?.title ?? humanize(icon.base)
  return {
    slug: icon.base.toLowerCase(),
    name,
    subtitle: subtitleFor(url, rawTags.map((t) => t.toLowerCase())),
    category: mapCategory(tags),
    keywords: tags.join(" "),
  }
}

const CATEGORY_ORDER = [
  "generic", "frontend", "backend", "database", "hosting", "devops",
  "auth", "language", "tooling", "editors", "monitoring", "design",
  "payment", "crypto", "ai", "media", "social", "gaming", "productivity",
  "browsers", "software",
]

console.log("Fetching svgl metadata…")
const apiEntries = await fetchApiEntries()

const apiBySlug = new Map()
for (const entry of apiEntries) {
  const keys = [...routeKeys(entry.route)]
  // The title itself matches components named after the brand, not the file.
  keys.push(normalize(entry.title ?? ""))
  for (const key of keys) {
    if (key && !apiBySlug.has(key)) apiBySlug.set(key, entry)
  }
}

const items = collectIcons()
  .filter((icon) => !droppedSlugs.has(icon.base.toLowerCase()))
  .map((icon) => {
    const item = buildItem(icon, apiBySlug.get(normalize(icon.base)))
    const slug = item.slug
    return {
      ...item,
      name: nameOverrides[slug] ?? item.name,
      subtitle: subtitleOverrides[slug] ?? item.subtitle,
      category: categoryOverrides[slug] ?? item.category,
    }
  })

items.sort(
  (a, b) =>
    CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
    a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
)

const banner = `// Generated by scripts/generate-svgl-catalog.mjs — do not edit by hand.
// Re-run \`node scripts/generate-svgl-catalog.mjs\` after bumping
// @ridemountainpig/svgl-react. Curated entries in catalog.ts take precedence.

import type { TechItem } from "./types"

export const generatedTechItems: TechItem[] = [
`

const body = items
  .map((item) => {
    const keywords = item.keywords ? `, keywords: ${JSON.stringify(item.keywords)}` : ""
    return `  { slug: ${JSON.stringify(item.slug)}, name: ${JSON.stringify(item.name)}, subtitle: ${JSON.stringify(item.subtitle)}, category: ${JSON.stringify(item.category)}${keywords} },`
  })
  .join("\n")

await writeFile(OUT_FILE, `${banner}${body}\n]\n`, "utf8")
console.log(`Wrote ${items.length} items to ${OUT_FILE.pathname}`)
