const CUSTOM_COLORS_KEY = "tech-stack-architect:custom-colors"

/** Two rows of swatches; beyond this the oldest saved color falls off. */
const MAX_CUSTOM_COLORS = 14

function normalizeHex(hex: string): string {
  const raw = hex.trim().replace(/^#/, "")
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw
  return `#${expanded.toLowerCase()}`
}

function isHexColor(hex: string): boolean {
  return /^#[0-9a-f]{6}$/.test(hex)
}

export function readCustomColors(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(CUSTOM_COLORS_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c): c is string => typeof c === "string" && isHexColor(c))
  } catch {
    return []
  }
}

function writeCustomColors(colors: string[]) {
  try {
    window.localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors))
  } catch {
    // Storage can be full or blocked; the picker still works without saving.
  }
}

/** Move `hex` to the front of the saved list (deduplicated), persisting it. */
export function saveCustomColor(hex: string): string[] {
  const color = normalizeHex(hex)
  const next = [color, ...readCustomColors().filter((c) => c !== color)].slice(
    0,
    MAX_CUSTOM_COLORS,
  )
  writeCustomColors(next)
  return next
}

/** Drop `hex` from the saved list and persist the result. */
export function removeCustomColor(hex: string): string[] {
  const color = normalizeHex(hex)
  const next = readCustomColors().filter((c) => c !== color)
  writeCustomColors(next)
  return next
}
