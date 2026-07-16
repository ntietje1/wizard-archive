import type { CanvasCandidateWorkBudget } from './workload'

type CanvasGeometryPoint = Readonly<{ x: number; y: number }>

export function canvasPolylinesIntersect(
  left: ReadonlyArray<CanvasGeometryPoint>,
  right: ReadonlyArray<CanvasGeometryPoint>,
  budget: CanvasCandidateWorkBudget,
): boolean {
  for (let leftIndex = 0; leftIndex < left.length - 1; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < right.length - 1; rightIndex += 1) {
      if (!budget.consume()) return false
      if (
        canvasSegmentsIntersect(
          left[leftIndex],
          left[leftIndex + 1],
          right[rightIndex],
          right[rightIndex + 1],
        )
      ) {
        return true
      }
    }
  }
  return false
}

function canvasSegmentsIntersect(
  a: CanvasGeometryPoint,
  b: CanvasGeometryPoint,
  c: CanvasGeometryPoint,
  d: CanvasGeometryPoint,
): boolean {
  const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x)
  if (Math.abs(denominator) < 1e-10) return false
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denominator
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}
