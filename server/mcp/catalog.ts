import { techCatalog } from "../../src/lib/catalog.js"

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/gu, "")

/** Search the same catalog as the palette, including aliases and spaced brand names. */
export function searchCatalog(queries: string[], limit: number) {
  return queries.map((query) => {
    const normalized = normalize(query)
    const words = query.toLowerCase().split(/\s+/u).filter(Boolean)
    const ranked = techCatalog.flatMap((item) => {
      const slug = normalize(item.slug)
      const name = normalize(item.name)
      const haystack = `${item.slug} ${item.name} ${item.subtitle} ${item.category} ${item.keywords ?? ""}`.toLowerCase()
      const score = !normalized ? 0
        : slug === normalized || name === normalized ? 4
        : slug.startsWith(normalized) || name.startsWith(normalized) ? 3
        : slug.includes(normalized) || name.includes(normalized) ? 2
        : words.every((word) => haystack.includes(word)) ? 1 : 0
      return score ? [{ item, score }] : []
    }).sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    return { query, total: ranked.length, items: ranked.slice(0, limit).map(({ item }) => item) }
  })
}
