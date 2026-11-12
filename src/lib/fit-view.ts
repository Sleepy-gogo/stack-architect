/**
 * Room fit-to-view leaves around the diagram for the canvas overlays: the tool
 * rail on the left, the align and zoom bars along the bottom. Pixels, not a
 * fraction of the viewport, so big screens don't waste a fifth of each side.
 */
export const FIT_VIEW_PADDING = { top: "48px", right: "48px", bottom: "104px", left: "96px" } as const
