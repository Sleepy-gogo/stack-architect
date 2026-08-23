import { useMemo } from "react"
import { useStore } from "@/lib/store"
import { nodeLabel } from "@/lib/node-labels"
import type { TechEdgeData } from "@/lib/types"
import { Section } from "./Section"

export function ConnectionsList({ nodeId }: { nodeId: string }) {
  const edges = useStore((s) => s.edges)
  const nodes = useStore((s) => s.nodes)
  const selectEdge = useStore((s) => s.selectEdge)

  const related = useMemo(
    () => edges.filter((e) => e.source === nodeId || e.target === nodeId),
    [edges, nodeId],
  )

  return (
    <Section title={`Connections (${related.length})`}>
      {related.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Drag from a dot on the edge of the card to connect this to something else.
        </p>
      ) : (
        <ul className="space-y-1">
          {related.map((e) => {
            const outgoing = e.source === nodeId
            const other = outgoing ? e.target : e.source
            const data = (e.data ?? {}) as TechEdgeData
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => selectEdge(e.id)}
                  className="flex w-full items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span
                    aria-hidden="true"
                    className="font-mono text-[11px] text-muted-foreground"
                  >
                    {outgoing ? "→" : "←"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground">
                    {nodeLabel(nodes.find((x) => x.id === other))}
                  </span>
                  {data.label ? (
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {data.label}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
