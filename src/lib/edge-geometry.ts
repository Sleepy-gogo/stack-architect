import type { AppEdge } from "./types.js"

/**
 * Drop stored attachment points, label offsets and manual routes so arrows
 * follow the new layout. Ports are shared out live by `assignPorts`.
 */
export function clearEdgeGeometry(edges: AppEdge[]): AppEdge[] {
  return edges.map((edge) => {
    const { sourcePoint: _s, targetPoint: _t, labelX: _x, labelY: _y, routePoints: _r, ...data } = edge.data ?? {}
    return { ...edge, data }
  })
}
