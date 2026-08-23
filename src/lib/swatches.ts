export const INK = "#0f172a"

/**
 * Documents store literal hex values, but pure ink vanishes on the dark
 * canvas; renderers swap it for the theme-aware `--swatch-ink` token
 * (near-white in dark mode) instead of painting it verbatim.
 */
export function resolveSwatch(hex: string | undefined): string | undefined {
  return hex !== undefined && hex.toLowerCase() === INK ? "var(--swatch-ink)" : hex
}
