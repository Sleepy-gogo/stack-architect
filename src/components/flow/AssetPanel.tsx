import { useEffect, useMemo, useRef, useState } from "react"
import { useReactFlow } from "@xyflow/react"
import {
  ChevronDownIcon,
  DatabaseIcon,
  FrameIcon,
  SearchIcon,
  ServerIcon,
  TypeIcon,
  XIcon,
} from "lucide-react"
import { categories, techCatalog } from "@/lib/catalog"
import { templates } from "@/lib/templates"
import { useStore } from "@/lib/store"
import type { TechCategoryId, TechItem } from "@/lib/types"
import { useCanvasPlacement } from "@/hooks/use-canvas-placement"
import { cn } from "@/lib/utils"
import { BrandIcon } from "./BrandIcon"
import { TemplatePreview } from "./TemplatePreview"
import { PanelHeading } from "./PanelHeading"
import { QuickAdd } from "./QuickAdd"
import { AssetRow } from "./AssetRow"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const templateDocs = new Map(templates.map((t) => [t.id, t.build()]))

export function AssetPanel() {
  const [query, setQuery] = useState("")
  const [openCategories, setOpenCategories] = useState<Set<TechCategoryId>>(
    () => new Set<TechCategoryId>(["generic", "frontend"]),
  )
  const searchRef = useRef<HTMLInputElement>(null)

  const addTechNode = useStore((s) => s.addTechNode)
  const addGroupNode = useStore((s) => s.addGroupNode)
  const addTextNode = useStore((s) => s.addTextNode)
  const loadDocument = useStore((s) => s.loadDocument)
  const recent = useStore((s) => s.recent)
  const place = useCanvasPlacement()
  const { fitView } = useReactFlow()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true

      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return techCatalog.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.subtitle.toLowerCase().includes(q) ||
        t.slug.includes(q) ||
        (t.keywords ?? "").includes(q),
    )
  }, [query])

  const byCategory = useMemo(() => {
    const map = new Map<TechCategoryId, TechItem[]>()
    for (const item of techCatalog) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return map
  }, [])

  const recentItems = recent
    .map((slug) => techCatalog.find((t) => t.slug === slug))
    .filter((t): t is TechItem => Boolean(t))

  const addTech = (slug: string) => {
    const { x, y } = place()
    addTechNode(slug, x, y)
  }

  const toggleCategory = (id: TechCategoryId) => {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 pt-4 pb-3">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.stopPropagation()
                setQuery("")
              }
            }}
            type="search"
            placeholder="Search assets"
            aria-label="Search assets"
            className="h-9 rounded-lg pr-16 pl-9 text-sm"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("")
                searchRef.current?.focus()
              }}
              className="absolute top-1/2 right-2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <XIcon className="size-3.5" />
            </button>
          ) : (
            <Kbd className="absolute top-1/2 right-2.5 -translate-y-1/2">⌘K</Kbd>
          )}
        </div>
      </div>

      <Tabs defaultValue="assets" className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList variant="line" className="h-auto w-full gap-4 border-b border-border px-4 pb-1.5">
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="assets" className="min-h-0 overflow-y-auto overscroll-contain">
          <div className="space-y-6 px-4 py-5">
            <section className="space-y-2">
              <PanelHeading>Quick add</PanelHeading>
              <div className="grid grid-cols-4 gap-2">
                <QuickAdd
                  label="Frame"
                  hint="Group related services"
                  icon={<FrameIcon className="size-4" aria-hidden="true" />}
                  onClick={() => {
                    const { x, y } = place(460, 300)
                    addGroupNode(x, y)
                  }}
                />
                <QuickAdd
                  label="Text"
                  hint="Floating text annotation"
                  icon={<TypeIcon className="size-4" aria-hidden="true" />}
                  onClick={() => {
                    const { x, y } = place(200, 80)
                    addTextNode(x, y)
                  }}
                />
                <QuickAdd
                  label="Service"
                  hint="Generic HTTP service"
                  icon={<ServerIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
                  onClick={() => {
                    const { x, y } = place()
                    addTechNode("service", x, y)
                  }}
                />
                <QuickAdd
                  label="Data"
                  hint="Generic data store"
                  icon={<DatabaseIcon className="size-4 text-muted-foreground" aria-hidden="true" />}
                  onClick={() => {
                    const { x, y } = place()
                    addTechNode("datastore", x, y)
                  }}
                />
              </div>
            </section>

            {results ? (
              <section className="space-y-2">
                <PanelHeading>
                  {results.length} {results.length === 1 ? "result" : "results"}
                </PanelHeading>
                {results.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs leading-relaxed text-muted-foreground">
                    Nothing matches “{query}”.
                    <br />
                    Try a shorter word, or drop a generic building block instead.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {results.map((item) => (
                      <AssetRow key={item.slug} item={item} onAdd={addTech} showCategory />
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              <>
                {recentItems.length > 0 ? (
                  <section className="space-y-2">
                    <PanelHeading>Recently used</PanelHeading>
                    <div className="flex flex-wrap gap-1.5">
                      {recentItems.map((item) => (
                        <Tooltip key={item.slug}>
                          <TooltipTrigger
                            render={
                              <button
                                type="button"
                                aria-label={`Add ${item.name}`}
                                onClick={() => addTech(item.slug)}
                                className="flex size-9 items-center justify-center rounded-full border border-border bg-card transition-colors hover:border-foreground/20 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              />
                            }
                          >
                            <BrandIcon slug={item.slug} size={18} />
                          </TooltipTrigger>
                          <TooltipContent>{item.name}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="space-y-1">
                  <PanelHeading>Categories</PanelHeading>
                  {categories.map((c) => {
                    const items = byCategory.get(c.id) ?? []
                    const open = openCategories.has(c.id)
                    return (
                      <div key={c.id}>
                        <button
                          type="button"
                          onClick={() => toggleCategory(c.id)}
                          aria-expanded={open}
                          aria-controls={`cat-${c.id}`}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                        >
                          <ChevronDownIcon
                            className={cn(
                              "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                              !open && "-rotate-90",
                            )}
                            aria-hidden="true"
                          />
                          <span className="flex-1 truncate text-[13px] font-medium text-foreground">
                            {c.label}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                            {items.length}
                          </span>
                        </button>
                        {open ? (
                          <ul id={`cat-${c.id}`} className="space-y-0.5 pb-2 pl-1.5">
                            {items.map((item) => (
                              <AssetRow key={item.slug} item={item} onAdd={addTech} />
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    )
                  })}
                </section>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="min-h-0 overflow-y-auto overscroll-contain">
          <div className="space-y-2 px-4 py-5">
            <p className="px-1 pb-1 text-xs leading-relaxed text-muted-foreground">
              Loading a template replaces the canvas. Your current diagram stays in the undo
              history.
            </p>
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  loadDocument(t.build())
                  window.setTimeout(() => fitView({ padding: 0.18, duration: 300 }), 60)
                }}
                className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:border-foreground/20 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <TemplatePreview
                  doc={templateDocs.get(t.id)!}
                  className="h-[52px] w-[74px] shrink-0 rounded-lg border border-border/70 bg-[var(--canvas)]"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-foreground">
                    {t.name}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {t.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <p className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
        Drag an asset onto the canvas, or press <Kbd className="h-4 px-1 text-[10px]">Enter</Kbd> to
        drop it in the middle of the view.
      </p>
    </div>
  )
}
