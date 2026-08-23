import { useEffect, useRef, useState } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import { AssetPanel } from "@/components/flow/AssetPanel"
import { Inspector } from "@/components/flow/inspector/Inspector"
import { FlowCanvas } from "@/components/flow/FlowCanvas"
import { TopBar } from "@/components/app/TopBar"
import { loadStarterDoc } from "@/lib/templates"
import { readStoredDocument, useStore } from "@/lib/store"
import { useEditorShortcuts } from "@/hooks/use-editor-shortcuts"
import { MOBILE_QUERY, useIsMobile } from "@/hooks/use-mobile"
import { useTheme } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"

function EditorLayout() {
  const [dark, setDark] = useTheme()
  const loadDocument = useStore((s) => s.loadDocument)
  const loadedRef = useRef(false)
  const isMobile = useIsMobile()

  // Panels start closed on phones and small tablets.
  const [leftOpen, setLeftOpen] = useState(() => !window.matchMedia(MOBILE_QUERY).matches)
  const [rightOpen, setRightOpen] = useState(() => !window.matchMedia(MOBILE_QUERY).matches)

  useEditorShortcuts()

  // Restore the last session, or seed the canvas with the reference diagram.
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    if (useStore.getState().nodes.length > 0) return
    loadDocument(readStoredDocument() ?? loadStarterDoc(), { resetHistory: true })
  }, [loadDocument])

  // On phones and small tablets the panels overlay the canvas instead of
  // splitting it, so entering that mode closes both to reveal the canvas.
  const overlayPanels = isMobile

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const onChange = () => {
      if (mql.matches) {
        setLeftOpen(false)
        setRightOpen(false)
      }
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <TopBar
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
      />

      <div className="relative flex min-h-0 flex-1">
        <aside
          aria-label="Assets"
          aria-hidden={!leftOpen}
          inert={!leftOpen}
          className={cn(
            "z-20 w-72 shrink-0 border-r border-border bg-sidebar transition-[width,transform] duration-200 ease-out",
            overlayPanels && "absolute inset-y-0 left-0 shadow-2xl",
            !leftOpen && (overlayPanels ? "-translate-x-full" : "w-0 overflow-hidden border-r-0"),
          )}
        >
          <div className="h-full w-72">
            <AssetPanel />
          </div>
        </aside>

        <main className="relative min-w-0 flex-1" aria-label="Canvas">
          <FlowCanvas />
        </main>

        <aside
          aria-label="Inspector"
          aria-hidden={!rightOpen}
          inert={!rightOpen}
          className={cn(
            "z-20 w-80 shrink-0 border-l border-border bg-sidebar transition-[width,transform] duration-200 ease-out",
            overlayPanels && "absolute inset-y-0 right-0 shadow-2xl",
            !rightOpen && (overlayPanels ? "translate-x-full" : "w-0 overflow-hidden border-l-0"),
          )}
        >
          <div className="h-full w-80">
            <Inspector />
          </div>
        </aside>

        {overlayPanels && (leftOpen || rightOpen) ? (
          <button
            type="button"
            aria-label="Close panel"
            onClick={() => {
              setLeftOpen(false)
              setRightOpen(false)
            }}
            className="absolute inset-0 z-10 bg-foreground/20 backdrop-blur-[1px]"
          />
        ) : null}
      </div>
    </div>
  )
}

export function Editor() {
  return (
    <ReactFlowProvider>
      <EditorLayout />
    </ReactFlowProvider>
  )
}
