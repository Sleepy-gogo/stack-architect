import { toCanvas, toSvg } from "html-to-image"
import { absoluteRect } from "./geometry"
import type { AppNode, GraphDocument } from "./types"

const PADDING = 96
const MAX_EDGE = 4096

const SVG_DATA_URL_PREFIX = "data:image/svg+xml;charset=utf-8,"

export type ImageExportOptions = {
  /** Paint the editor's graph-paper grid behind the diagram. */
  grid?: boolean
  /** Leave the background fully transparent; implies `grid: false`. */
  transparent?: boolean
  /** Distance between minor grid lines in flow units (the editor's grid size). */
  gridSize?: number
}

type Bounds = { x: number; y: number; width: number; height: number }
type Transform = { x: number; y: number; zoom: number }

/** Everything needed to paint the grid into an export, in output pixels. */
type GridPaint = {
  width: number
  height: number
  minorGap: number
  majorGap: number
  minorOffsetX: number
  minorOffsetY: number
  majorOffsetX: number
  majorOffsetY: number
  minorColor: string
  majorColor: string
}

type RenderOptions = {
  format: "png" | "svg"
  /** Solid backdrop color, or null for a fully transparent export. */
  background: string | null
  grid: boolean
  gridSize: number
  minorColor: string
  majorColor: string
}

/**
 * Maps `bounds` onto a canvas of `width`×`height`, leaving exactly `padding`
 * pixels of margin on every side. Unlike `getViewportForBounds` — whose
 * `padding` argument is a fraction of the bounds, not pixels — this works in
 * plain flow units, so small diagrams are not blown up past `maxZoom` and big
 * ones shrink to fit inside the capped canvas.
 */
function fitTransform(bounds: Bounds, width: number, height: number): Transform {
  const innerWidth = Math.max(1, width - PADDING * 2)
  const innerHeight = Math.max(1, height - PADDING * 2)
  const zoom = Math.min(innerWidth / Math.max(1, bounds.width), innerHeight / Math.max(1, bounds.height), 2)
  return {
    x: PADDING + (innerWidth - bounds.width * zoom) / 2 - bounds.x * zoom,
    y: PADDING + (innerHeight - bounds.height * zoom) / 2 - bounds.y * zoom,
    zoom,
  }
}

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "diagram"
}

function download(href: string, filename: string) {
  const link = document.createElement("a")
  link.download = filename
  link.href = href
  link.click()
}

export class EmptyDiagramError extends Error {
  constructor() {
    super("There is nothing on the canvas to export yet.")
    this.name = "EmptyDiagramError"
  }
}

/**
 * Bounding box of all visible nodes in absolute flow coordinates. Child nodes
 * store positions relative to their parent frame, so `getNodesBounds` cannot
 * be used directly here — the parent chain has to be resolved first.
 */
function graphBounds(nodes: AppNode[]): Bounds {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    if (node.hidden) continue
    const r = absoluteRect(node, byId)
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
  }
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/* ------------------------------------------------------------------ */
/* Grid painting                                                       */
/* ------------------------------------------------------------------ */

/**
 * Grid geometry for the exported image. The editor's grid is glued to flow
 * coordinates (React Flow offsets the pattern by the viewport transform), so
 * the export repeats the same trick with the fitted transform: lines land at
 * `transform.x + k·gap·zoom`, wrapped into the first tile.
 */
function gridPaint(
  transform: Transform,
  width: number,
  height: number,
  gridSize: number,
  minorColor: string,
  majorColor: string,
): GridPaint {
  const wrap = (value: number, modulo: number) => ((value % modulo) + modulo) % modulo
  const minorGap = Math.max(gridSize * transform.zoom, 0.5)
  const majorGap = minorGap * 5
  return {
    width,
    height,
    minorGap,
    majorGap,
    minorOffsetX: wrap(transform.x, minorGap),
    minorOffsetY: wrap(transform.y, minorGap),
    majorOffsetX: wrap(transform.x, majorGap),
    majorOffsetY: wrap(transform.y, majorGap),
    minorColor,
    majorColor,
  }
}

function paintGrid(ctx: CanvasRenderingContext2D, p: GridPaint): void {
  // Half-pixel offsets keep 1px strokes crisp on the raster grid.
  const crisp = (value: number) => Math.round(value) + 0.5
  const layer = (gap: number, offsetX: number, offsetY: number, color: string) => {
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let x = crisp(offsetX); x < p.width; x += gap) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, p.height)
    }
    for (let y = crisp(offsetY); y < p.height; y += gap) {
      ctx.moveTo(0, y)
      ctx.lineTo(p.width, y)
    }
    ctx.stroke()
  }
  layer(p.minorGap, p.minorOffsetX, p.minorOffsetY, p.minorColor)
  layer(p.majorGap, p.majorOffsetX, p.majorOffsetY, p.majorColor)
}

/** Repaints an already-rendered PNG over a solid backdrop plus the grid. */
function composeGridPng(source: HTMLCanvasElement, paint: GridPaint, background: string): string {
  const out = document.createElement("canvas")
  out.width = source.width
  out.height = source.height
  const ctx = out.getContext("2d")
  if (!ctx) return source.toDataURL("image/png")
  const scale = source.width / paint.width
  ctx.save()
  ctx.scale(scale, scale)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, paint.width, paint.height)
  paintGrid(ctx, paint)
  ctx.restore()
  ctx.drawImage(source, 0, 0)
  return out.toDataURL("image/png")
}

function svgPattern(id: string, gap: number, x: number, y: number, color: string): string {
  const n = (value: number) => Number(value.toFixed(3))
  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" x="${n(x)}" y="${n(y)}" width="${n(gap)}" height="${n(gap)}">` +
    `<path d="M ${n(gap)} 0 L 0 0 L 0 ${n(gap)}" fill="none" stroke="${color}" stroke-width="1"/>` +
    "</pattern>"
  )
}

/** Splices a backdrop + grid under the content of an html-to-image SVG data URL. */
function injectGridSvg(dataUrl: string, paint: GridPaint, background: string): string {
  const svg = decodeURIComponent(dataUrl.slice(SVG_DATA_URL_PREFIX.length))
  const openTagEnd = svg.indexOf(">")
  if (openTagEnd === -1) return dataUrl
  const underlay = [
    "<defs>",
    svgPattern("ta-grid-minor", paint.minorGap, paint.minorOffsetX, paint.minorOffsetY, paint.minorColor),
    svgPattern("ta-grid-major", paint.majorGap, paint.majorOffsetX, paint.majorOffsetY, paint.majorColor),
    "</defs>",
    `<rect width="${paint.width}" height="${paint.height}" fill="${background}"/>`,
    `<rect width="${paint.width}" height="${paint.height}" fill="url(#ta-grid-minor)"/>`,
    `<rect width="${paint.width}" height="${paint.height}" fill="url(#ta-grid-major)"/>`,
  ].join("")
  const patched =
    svg.slice(0, openTagEnd + 1) + underlay + svg.slice(openTagEnd + 1)
  return SVG_DATA_URL_PREFIX + encodeURIComponent(patched)
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

/**
 * Renders the whole graph at a fixed scale, independent of the current viewport,
 * so the exported image always contains every node with even padding around it.
 */
async function renderViewport(nodes: AppNode[], options: RenderOptions): Promise<string> {
  const viewportEl = document.querySelector<HTMLElement>(".react-flow__viewport")
  if (!viewportEl) throw new Error("Canvas is not ready yet.")
  if (nodes.length === 0) throw new EmptyDiagramError()

  const bounds = graphBounds(nodes)
  // Node labels sit below the measured node box, so pad the bottom a little more.
  const width = Math.min(Math.round(bounds.width + PADDING * 2), MAX_EDGE)
  const height = Math.min(Math.round(bounds.height + PADDING * 2), MAX_EDGE)

  const transform = fitTransform(bounds, width, height)

  const paint =
    options.grid && options.background !== null
      ? gridPaint(transform, width, height, options.gridSize, options.minorColor, options.majorColor)
      : null

  // When the grid is painted underneath, the diagram itself has to be captured
  // on a transparent backdrop — html-to-image would otherwise bake the solid
  // background into it and cover the grid.
  const sharedOptions = {
    backgroundColor: !paint && options.background !== null ? options.background : undefined,
    width,
    height,
    cacheBust: true,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
    },
    filter: (node: HTMLElement) => {
      // React Flow's own chrome (controls, minimap, panels) is not part of the diagram.
      const cls = typeof node.className === "string" ? node.className : ""
      return !cls.includes("react-flow__panel") && !cls.includes("react-flow__minimap")
    },
  }

  if (options.format === "png") {
    const canvas = await toCanvas(viewportEl, { ...sharedOptions, pixelRatio: 2 })
    if (!paint || !options.background) return canvas.toDataURL("image/png")
    return composeGridPng(canvas, paint, options.background)
  }

  const dataUrl = await toSvg(viewportEl, sharedOptions)
  if (!paint || !options.background) return dataUrl
  return injectGridSvg(dataUrl, paint, options.background)
}

export async function exportImage(
  nodes: AppNode[],
  title: string,
  format: "png" | "svg",
  options: ImageExportOptions = {},
): Promise<void> {
  const transparent = options.transparent ?? false
  const grid = (options.grid ?? false) && !transparent
  const style = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback

  const dataUrl = await renderViewport(nodes, {
    format,
    background: transparent ? null : read("--canvas", "#f6f8fb"),
    grid,
    gridSize: options.gridSize ?? 8,
    minorColor: read("--grid-minor", "#e4e8ef"),
    majorColor: read("--grid-major", "#cdd3de"),
  })
  download(dataUrl, `${slugify(title)}.${format}`)
}

export function exportJson(doc: GraphDocument, title: string): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  try {
    download(url, `${slugify(title)}.json`)
  } finally {
    // Give the click a tick to start before releasing the object URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

export async function readJsonFile(file: File): Promise<GraphDocument> {
  const text = await file.text()
  const doc = JSON.parse(text) as GraphDocument
  if (!Array.isArray(doc.nodes) || !Array.isArray(doc.edges)) {
    throw new Error("That file does not contain a diagram.")
  }
  return doc
}
