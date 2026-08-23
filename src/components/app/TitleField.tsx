import { useState } from "react"

export function TitleField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = () => {
    // Escape already flipped `editing` off before blur arrives; the field
    // must then keep the canonical value instead of applying the draft.
    if (!editing) return
    setEditing(false)
    const next = draft.trim()
    if (next && next !== value) onChange(next)
  }

  return (
    <input
      value={editing ? draft : value}
      aria-label="Diagram title"
      onFocus={() => {
        setDraft(value)
        setEditing(true)
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur()
        if (e.key === "Escape") {
          setEditing(false)
          e.currentTarget.blur()
        }
      }}
      className="w-32 min-w-0 truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-foreground transition-colors hover:border-border focus:border-ring focus:bg-card focus:outline-none sm:w-48"
    />
  )
}
