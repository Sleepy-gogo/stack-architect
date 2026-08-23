import { useState } from "react"
import { FrameIcon } from "lucide-react"
import { useStore } from "@/lib/store"
import { resolveSwatch } from "@/lib/swatches"
import type { AppNode, GroupNodeData } from "@/lib/types"
import { BrandIcon } from "../BrandIcon"
import { InspectorHeader } from "./InspectorHeader"
import { Section } from "./Section"
import { Row } from "./Row"
import { Swatches } from "./Swatches"
import { StyleButton } from "./StyleButton"
import { PositionFields } from "./PositionFields"
import { IconPicker } from "./IconPicker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function FrameInspector({ node }: { node: AppNode }) {
  const d = node.data as GroupNodeData
  const updateNodeData = useStore((s) => s.updateNodeData)
  const deleteNode = useStore((s) => s.deleteNode)
  const duplicateNode = useStore((s) => s.duplicateNode)
  const [picking, setPicking] = useState(false)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <InspectorHeader
        icon={
          d.icon ? (
            <BrandIcon slug={d.icon} size={18} />
          ) : (
            <FrameIcon
              className="size-4"
              style={{ color: resolveSwatch(d.color) }}
              aria-hidden="true"
            />
          )
        }
        title={d.label || "Untitled frame"}
        kind="Frame"
        onDelete={() => deleteNode(node.id)}
        onDuplicate={() => duplicateNode(node.id)}
      />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto border-t border-border px-5 py-5">
        <Section title="Content">
          <Row label="Icon">
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                {d.icon ? (
                  <BrandIcon slug={d.icon} size={18} />
                ) : (
                  <FrameIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
              </span>
              {d.icon ? (
                <>
                  <Button
                    variant="outline"
                    size="xs"
                    aria-expanded={picking}
                    onClick={() => setPicking((v) => !v)}
                  >
                    {picking ? "Done" : "Change"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      updateNodeData(node.id, { icon: undefined })
                      setPicking(false)
                    }}
                  >
                    Remove
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="xs" onClick={() => setPicking(true)}>
                  Choose
                </Button>
              )}
            </div>
          </Row>

          {picking ? (
            <IconPicker
              onPick={(slug) => {
                updateNodeData(node.id, { icon: slug })
                setPicking(false)
              }}
            />
          ) : null}

          <Row label="Label" htmlFor="frame-label">
            <Input
              id="frame-label"
              value={d.label}
              onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
              className="h-9 rounded-lg text-sm"
            />
          </Row>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Frame labels render in uppercase on the canvas.
          </p>
        </Section>

        <Section title="Appearance">
          <Row label="Color">
            <Swatches
              value={d.color}
              onChange={(hex) => updateNodeData(node.id, { color: hex })}
            />
          </Row>
          <Row label="Border">
            <div className="grid grid-cols-2 gap-1.5">
              <StyleButton
                active={!d.dashed}
                label="Solid"
                dashed={false}
                onClick={() => updateNodeData(node.id, { dashed: false })}
              />
              <StyleButton
                active={d.dashed === true}
                label="Dashed"
                dashed
                onClick={() => updateNodeData(node.id, { dashed: true })}
              />
            </div>
          </Row>
        </Section>

        <PositionFields node={node} showSize />
      </div>
    </div>
  )
}
