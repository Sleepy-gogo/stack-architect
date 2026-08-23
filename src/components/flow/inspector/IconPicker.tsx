import { useMemo, useState } from "react"
import { SearchIcon } from "lucide-react"
import { techCatalog } from "@/lib/catalog"
import { BrandIcon } from "../BrandIcon"
import { Input } from "@/components/ui/input"

export function IconPicker({ onPick }: { onPick: (slug: string) => void }) {
  const [query, setQuery] = useState("")
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? techCatalog.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.slug.includes(q) ||
            (t.keywords ?? "").includes(q),
        )
      : techCatalog
    return list.slice(0, 60)
  }, [query])

  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-2">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons"
          aria-label="Search icons"
          className="h-9 rounded-lg pl-8 text-sm"
        />
      </div>
      {results.length === 0 ? (
        <p className="px-1 py-3 text-center text-xs text-muted-foreground">
          No icon matches “{query}”
        </p>
      ) : (
        <div className="grid max-h-44 grid-cols-6 gap-1 overflow-y-auto">
          {results.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => onPick(t.slug)}
              aria-label={t.name}
              title={t.name}
              className="flex aspect-square items-center justify-center rounded-lg transition-colors hover:bg-card focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <BrandIcon slug={t.slug} size={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
