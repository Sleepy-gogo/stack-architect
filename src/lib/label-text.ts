import { NODE_WIDTH, TECH_CARD_SIZE } from "./types.js"

/**
 * Text metrics for tech-card labels and frame headings, shared by the server
 * layout, the MCP review and the editor's fallback before it measures the DOM.
 * They mirror TechNode and GroupNode; change them together.
 */
export const NAME_CHAR_WIDTH = 8.4
export const SUBTITLE_CHAR_WIDTH = 6.7
/** Names and subtitles each wrap to at most this many lines, then clamp. */
export const MAX_LABEL_LINES = 2
const NAME_LINE = 19
const SUBTITLE_LINE = 14
/** Space between the icon card and the name, and between name and subtitle. */
const LABEL_TOP = 10
const LABEL_GAP = 2

const charsPerLine = (charWidth: number) => Math.floor(NODE_WIDTH / charWidth)
export const NAME_CHARS_PER_LINE = charsPerLine(NAME_CHAR_WIDTH)
export const SUBTITLE_CHARS_PER_LINE = charsPerLine(SUBTITLE_CHAR_WIDTH)

/** Greedy word wrap, breaking words longer than a line like the browser does. */
export function wrapText(text: string, perLine: number): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    let rest = word
    while (rest.length > perLine) {
      if (line) {
        lines.push(line)
        line = ""
      }
      lines.push(rest.slice(0, perLine))
      rest = rest.slice(perLine)
    }
    if (!line) line = rest
    else if (line.length + 1 + rest.length <= perLine) line = `${line} ${rest}`
    else {
      lines.push(line)
      line = rest
    }
  }
  if (line) lines.push(line)
  return lines
}

type CardText = { name?: unknown; subtitle?: unknown }

const text = (value: unknown) => (typeof value === "string" ? value : "")

/** The lines a card shows, before clamping. */
export function cardLines(data: CardText): { name: string[]; subtitle: string[] } {
  return {
    name: wrapText(text(data.name), NAME_CHARS_PER_LINE),
    subtitle: wrapText(text(data.subtitle), SUBTITLE_CHARS_PER_LINE),
  }
}

/** Which labels won't fit in their two lines and get cut off with an ellipsis. */
export function clippedLabels(data: CardText): ("name" | "subtitle")[] {
  const lines = cardLines(data)
  return (["name", "subtitle"] as const).filter((key) => lines[key].length > MAX_LABEL_LINES)
}

/** Estimated line boxes under the card, relative to the node's position. */
export function estimateCardLabelBoxes(data: CardText): { x: number; y: number; w: number; h: number }[] {
  const lines = cardLines(data)
  const boxes: { x: number; y: number; w: number; h: number }[] = []
  let y = TECH_CARD_SIZE + LABEL_TOP
  const add = (rows: string[], charWidth: number, height: number) => {
    for (const row of rows.slice(0, MAX_LABEL_LINES)) {
      const w = Math.min(NODE_WIDTH, row.length * charWidth + 8)
      boxes.push({ x: (NODE_WIDTH - w) / 2, y, w, h: height })
      y += height
    }
  }
  add(lines.name, NAME_CHAR_WIDTH, NAME_LINE)
  if (lines.subtitle.length) y += LABEL_GAP
  add(lines.subtitle, SUBTITLE_CHAR_WIDTH, SUBTITLE_LINE)
  return boxes
}

/** Height of the card plus its wrapped labels. */
export function cardHeight(data: CardText): number {
  const lines = cardLines(data)
  const name = Math.min(MAX_LABEL_LINES, Math.max(1, lines.name.length)) * NAME_LINE
  const subtitle = lines.subtitle.length ? LABEL_GAP + Math.min(MAX_LABEL_LINES, lines.subtitle.length) * SUBTITLE_LINE : 0
  return TECH_CARD_SIZE + LABEL_TOP + name + subtitle
}

/**
 * Narrowest frame whose heading shows in full: the heading starts 28px in,
 * keeps 28px clear on the right, and carries a 16px icon plus padding.
 */
export function frameHeadingWidth(label: unknown): number {
  return Math.ceil(56 + 38 + text(label).length * 8.3)
}
