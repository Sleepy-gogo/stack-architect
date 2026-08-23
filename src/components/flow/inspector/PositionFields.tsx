import { useStore } from "@/lib/store"
import type { AppNode } from "@/lib/types"
import { Section } from "./Section"
import { NumberField } from "./NumberField"

export function PositionFields({ node, showSize }: { node: AppNode; showSize?: boolean }) {
  const moveNode = useStore((s) => s.moveNode)
  const width = (node.width ?? (node.style?.width as number) ?? 0) as number
  const height = (node.height ?? (node.style?.height as number) ?? 0) as number

  return (
    <Section title={showSize ? "Size & position" : "Position"}>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="X"
          value={Math.round(node.position.x)}
          onChange={(v) => moveNode(node.id, "x", v)}
        />
        <NumberField
          label="Y"
          value={Math.round(node.position.y)}
          onChange={(v) => moveNode(node.id, "y", v)}
        />
        {showSize ? (
          <>
            <NumberField label="W" value={Math.round(width)} readOnly />
            <NumberField label="H" value={Math.round(height)} readOnly />
          </>
        ) : null}
      </div>
      {showSize ? (
        <p className="text-[11px] text-muted-foreground">
          Drag the frame handles on the canvas to resize.
        </p>
      ) : null}
    </Section>
  )
}
