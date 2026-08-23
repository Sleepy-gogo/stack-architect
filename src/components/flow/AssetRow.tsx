import { categories } from "@/lib/catalog"
import type { TechItem } from "@/lib/types"
import { BrandIcon } from "./BrandIcon"

export function AssetRow({
  item,
  onAdd,
  showCategory,
}: {
  item: TechItem
  onAdd: (slug: string) => void
  showCategory?: boolean
}) {
  const category = categories.find((c) => c.id === item.category)

  return (
    <li>
      <button
        type="button"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("application/tech-stack", item.slug)
          e.dataTransfer.effectAllowed = "copy"
        }}
        onClick={() => onAdd(item.slug)}
        className="flex w-full cursor-grab items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
          <BrandIcon slug={item.slug} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] leading-tight font-medium text-foreground">
            {item.name}
          </span>
          <span className="block truncate font-mono text-[10.5px] leading-tight text-muted-foreground">
            {item.subtitle}
          </span>
        </span>
        {showCategory && category ? (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              color: category.color,
              backgroundColor: `color-mix(in oklch, ${category.color} 14%, transparent)`,
            }}
          >
            {category.label}
          </span>
        ) : null}
      </button>
    </li>
  )
}
