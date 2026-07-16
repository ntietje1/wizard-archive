export type CanvasBounds = Readonly<{
  x: number
  y: number
  width: number
  height: number
}>

export function canvasBoundsUnion(bounds: ReadonlyArray<CanvasBounds>): CanvasBounds | null {
  if (bounds.length === 0) return null
  const left = Math.min(...bounds.map((value) => value.x))
  const top = Math.min(...bounds.map((value) => value.y))
  const right = Math.max(...bounds.map((value) => value.x + value.width))
  const bottom = Math.max(...bounds.map((value) => value.y + value.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}
