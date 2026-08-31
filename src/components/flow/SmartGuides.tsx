import { ViewportPortal, useViewport } from "@xyflow/react"
import type { SmartGuide } from "@/lib/smart-guides"

export function SmartGuides({ guides }: { guides: SmartGuide[] }) {
  const { zoom } = useViewport()
  if (guides.length === 0) return null

  const cap = 5 / zoom

  return (
    <ViewportPortal>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-[3000] overflow-visible"
        width="1"
        height="1"
      >
        {guides.map((guide, index) => {
          if (guide.kind === "alignment") {
            return guide.axis === "x" ? (
              <line
                key={`alignment-x-${guide.value}-${index}`}
                x1={guide.value}
                x2={guide.value}
                y1={guide.from}
                y2={guide.to}
                className="smart-guide-line"
              />
            ) : (
              <line
                key={`alignment-y-${guide.value}-${index}`}
                x1={guide.from}
                x2={guide.to}
                y1={guide.value}
                y2={guide.value}
                className="smart-guide-line"
              />
            )
          }

          return guide.axis === "x" ? (
            <g key={`gap-x-${guide.from}-${guide.to}-${index}`} className="smart-gap-guide">
              <line x1={guide.from} x2={guide.to} y1={guide.cross} y2={guide.cross} />
              <line
                x1={guide.from}
                x2={guide.from}
                y1={guide.cross - cap}
                y2={guide.cross + cap}
              />
              <line x1={guide.to} x2={guide.to} y1={guide.cross - cap} y2={guide.cross + cap} />
            </g>
          ) : (
            <g key={`gap-y-${guide.from}-${guide.to}-${index}`} className="smart-gap-guide">
              <line x1={guide.cross} x2={guide.cross} y1={guide.from} y2={guide.to} />
              <line
                x1={guide.cross - cap}
                x2={guide.cross + cap}
                y1={guide.from}
                y2={guide.from}
              />
              <line x1={guide.cross - cap} x2={guide.cross + cap} y1={guide.to} y2={guide.to} />
            </g>
          )
        })}
      </svg>
    </ViewportPortal>
  )
}
