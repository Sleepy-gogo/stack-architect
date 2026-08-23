import { useEffect } from "react"
import { useStore } from "@/lib/store"

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable === true
  )
}

/** Editor-wide keyboard shortcuts. Anything typed into a field is left alone. */
export function useEditorShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const store = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (mod && key === "z") {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        if (e.shiftKey) store.redo()
        else store.undo()
        return
      }

      if (mod && key === "y") {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        store.redo()
        return
      }

      // Clipboard and selection commands stay live while typing so cut/copy/
      // paste behave like normal text editing inside fields.
      if (mod && key === "c" && !isTypingTarget(e.target)) {
        store.copySelection()
        return
      }
      if (mod && key === "x" && !isTypingTarget(e.target)) {
        store.cutSelection()
        return
      }
      if (mod && key === "v") {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        store.pasteClipboard()
        return
      }
      if (mod && key === "a") {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        store.selectAll()
        return
      }

      if (mod && key === "d") {
        if (isTypingTarget(e.target) || !store.selectedNodeId) return
        e.preventDefault()
        store.duplicateNode(store.selectedNodeId)
        return
      }

      if (isTypingTarget(e.target) || mod) return

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault()
        store.deleteSelection()
        return
      }

      if (e.key === "Escape") {
        store.setTool("select")
        store.deselectAll()
        return
      }

      // Arrow keys nudge whatever is selected; shift doubles the distance.
      if (e.key.startsWith("Arrow")) {
        const hasSelection =
          store.nodes.some((n) => n.selected) || store.edges.some((ed) => ed.selected)
        if (!hasSelection) return
        e.preventDefault()
        const step = e.shiftKey ? store.gridSize * 4 : store.gridSize
        switch (e.key) {
          case "ArrowLeft":
            store.nudgeSelection(-step, 0)
            break
          case "ArrowRight":
            store.nudgeSelection(step, 0)
            break
          case "ArrowUp":
            store.nudgeSelection(0, -step)
            break
          case "ArrowDown":
            store.nudgeSelection(0, step)
            break
        }
        return
      }

      switch (key) {
        case "v":
          store.setTool("select")
          break
        case "h":
          store.setTool("pan")
          break
        case "f":
          store.setTool("frame")
          break
        case "n":
          store.setTool("text")
          break
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])
}
