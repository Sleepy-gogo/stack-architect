import { useState } from "react"
import { useStore } from "@/lib/store"
import { categoryMap, techCatalog } from "@/lib/catalog"
import type { AppNode, TechNodeData } from "@/lib/types"
import { BrandIcon } from "../BrandIcon"
import { InspectorHeader } from "./InspectorHeader"
import { Section } from "./Section"
import { Row } from "./Row"
import { Swatches } from "./Swatches"
import { PositionFields } from "./PositionFields"
import { ConnectionsList } from "./ConnectionsList"
import { IconPicker } from "./IconPicker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function TechInspector({ node }: { node: AppNode }) {
  const d = node.data as TechNodeData
  const updateNodeData = useStore((s) => s.updateNodeData)
  const deleteNode = useStore((s) => s.deleteNode)
  const duplicateNode = useStore((s) => s.duplicateNode)
  const cat = categoryMap[d.category as keyof typeof categoryMap]
  const accent = d.colorOverride ?? cat?.color ?? "#64748b"
  const [picking, setPicking] = useState(false)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <InspectorHeader
        icon={<BrandIcon slug={d.slug} size={20} />}
        title={d.name || "Untitled node"}
        kind={cat?.label ?? "Node"}
        onDelete={() => deleteNode(node.id)}
        onDuplicate={() => duplicateNode(node.id)}
      />

      <Tabs defaultValue="properties" className="flex min-h-0 flex-1 flex-col gap-0">
        <TabsList variant="line" className="h-auto w-full gap-4 border-b border-border px-5 pb-1.5">
          <TabsTrigger value="properties">Properties</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="min-h-0 overflow-y-auto">
          <div className="space-y-5 px-5 py-5">
            <Section title="Content">
              <Row label="Icon">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                    <BrandIcon slug={d.slug} size={18} />
                  </span>
                  <Button
                    variant="outline"
                    size="xs"
                    aria-expanded={picking}
                    onClick={() => setPicking((v) => !v)}
                  >
                    {picking ? "Done" : "Change"}
                  </Button>
                </div>
              </Row>

              {picking ? (
                <IconPicker
                  onPick={(slug) => {
                    const item = techCatalog.find((t) => t.slug === slug)
                    updateNodeData(node.id, {
                      slug,
                      name: item?.name ?? slug,
                      subtitle: item?.subtitle ?? "",
                      category: item?.category ?? d.category,
                    })
                    setPicking(false)
                  }}
                />
              ) : null}

              <Row label="Label" htmlFor="insp-name">
                <Input
                  id="insp-name"
                  value={d.name}
                  onChange={(e) => updateNodeData(node.id, { name: e.target.value })}
                  className="h-9 rounded-lg text-sm"
                />
              </Row>
              <Row label="Subtitle" htmlFor="insp-subtitle">
                <Input
                  id="insp-subtitle"
                  value={d.subtitle}
                  placeholder="e.g. http server"
                  onChange={(e) => updateNodeData(node.id, { subtitle: e.target.value })}
                  className="h-9 rounded-lg text-sm"
                />
              </Row>
            </Section>

            <Section title="Notes">
              <Textarea
                aria-label="Notes about this node"
                value={d.note ?? ""}
                rows={3}
                placeholder="Why is this in the stack? Notes stay in the file and never render on the canvas."
                onChange={(e) => updateNodeData(node.id, { note: e.target.value })}
                className="min-h-0 resize-y bg-input/50 text-sm leading-relaxed"
              />
            </Section>

            <ConnectionsList nodeId={node.id} />
          </div>
        </TabsContent>

        <TabsContent value="style" className="min-h-0 overflow-y-auto">
          <div className="space-y-5 px-5 py-5">
            <Section title="Appearance">
              <Row label="Accent">
                <Swatches
                  label="Accent"
                  value={accent}
                  onChange={(hex) => updateNodeData(node.id, { colorOverride: hex })}
                />
              </Row>
              <Row label="Dark card">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={d.dark ?? false}
                    onCheckedChange={(checked) => updateNodeData(node.id, { dark: checked })}
                    aria-label="Dark card"
                  />
                  <span className="text-xs text-muted-foreground">
                    {d.dark ? "Inverted" : "Light"}
                  </span>
                </div>
              </Row>
            </Section>

            <PositionFields node={node} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
