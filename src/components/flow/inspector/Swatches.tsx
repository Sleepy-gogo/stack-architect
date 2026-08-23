import { useState } from "react"
import { HexColorInput, HexColorPicker } from "react-colorful"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { readCustomColors, removeCustomColor, saveCustomColor } from "@/lib/custom-colors"
import { resolveSwatch } from "@/lib/swatches"
import { cn } from "@/lib/utils"

const SWATCHES: { hex: string; name: string }[] = [
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#0ea5e9", name: "Sky" },
  { hex: "#14b8a6", name: "Teal" },
  { hex: "#22c55e", name: "Green" },
  { hex: "#eab308", name: "Yellow" },
  { hex: "#f97316", name: "Orange" },
  { hex: "#ef4444", name: "Red" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#a855f7", name: "Purple" },
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#64748b", name: "Slate" },
  { hex: "#0f172a", name: "Ink" },
]

export function Swatches({
  value,
  onChange,
  label = "Color",
}: {
  value: string
  onChange: (hex: string) => void
  label?: string
}) {
  const normalized = value.toLowerCase()
  const isPreset = SWATCHES.some((s) => s.hex === normalized)
  // Guards the picker against malformed stored colors.
  const safeHex = /^#[0-9a-f]{6}$/i.test(value) ? normalized : "#64748b"
  const [saved, setSaved] = useState<string[]>(readCustomColors)

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {SWATCHES.map((s) => {
        const active = s.hex === normalized
        return (
          <button
            key={s.hex}
            type="button"
            aria-label={s.name}
            aria-pressed={active}
            onClick={() => onChange(s.hex)}
            className={cn(
              "size-5 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
            )}
            style={{ backgroundColor: resolveSwatch(s.hex) }}
          />
        )
      })}
      <Popover onOpenChange={(open) => open && setSaved(readCustomColors())}>
        <PopoverTrigger
          aria-label={`Custom ${label.toLowerCase()}`}
          aria-pressed={!isPreset}
          className={cn(
            "flex size-5 cursor-pointer items-center justify-center rounded-full border border-dashed border-border text-[9px] font-semibold text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            !isPreset && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
          )}
        >
          <span aria-hidden="true">+</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 gap-3 p-3">
          <div className="accent-picker">
            <HexColorPicker color={safeHex} onChange={onChange} />
          </div>
          <div className="flex items-center gap-2">
            <HexColorInput
              prefixed
              color={safeHex}
              onChange={onChange}
              aria-label={`${label} hex value`}
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-input/50 px-2 font-mono text-xs uppercase text-foreground outline-none focus-visible:border-ring"
            />
            <Button size="sm" variant="outline" onClick={() => setSaved(saveCustomColor(safeHex))}>
              Save
            </Button>
          </div>
          {saved.length > 0 ? (
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">Saved</div>
              <div className="flex flex-wrap gap-1.5">
                {saved.map((hex) => (
                  <div key={hex} className="group relative">
                    <button
                      type="button"
                      aria-label={`Use saved color ${hex}`}
                      onClick={() => onChange(hex)}
                      className={cn(
                        "size-5 rounded-full transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        hex === normalized &&
                          "ring-2 ring-foreground ring-offset-2 ring-offset-background",
                      )}
                      style={{ backgroundColor: resolveSwatch(hex) }}
                    />
                    <button
                      type="button"
                      aria-label={`Remove saved color ${hex}`}
                      onClick={() => setSaved(removeCustomColor(hex))}
                      className="absolute -top-1 -right-1 hidden size-3.5 items-center justify-center rounded-full bg-foreground text-[8px] leading-none text-background group-hover:flex"
                    >
                      <X strokeWidth={3} className="size-2" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}
