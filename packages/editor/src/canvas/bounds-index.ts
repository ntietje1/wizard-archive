import type { CanvasBounds } from './canvas-bounds'
import type { CanvasCandidateWorkBudget } from './workload'

type CanvasBoundsEntry<T> = Readonly<{ bounds: CanvasBounds; value: T }>

type CanvasBoundsQuery<T> = Readonly<{
  values: ReadonlyArray<T>
  visited: number
}>

type CanvasBoundsTree<T> =
  | Readonly<{ bounds: CanvasBounds; entry: CanvasBoundsEntry<T>; left?: never; right?: never }>
  | Readonly<{
      bounds: CanvasBounds
      entry?: never
      left: CanvasBoundsTree<T>
      right: CanvasBoundsTree<T>
    }>

export function createCanvasBoundsIndex<T>(entries: ReadonlyArray<CanvasBoundsEntry<T>>) {
  const root = buildBoundsTree([...entries], 0)
  return {
    query(
      bounds: CanvasBounds,
      budget: CanvasCandidateWorkBudget,
      limit = Number.POSITIVE_INFINITY,
    ): CanvasBoundsQuery<T> {
      if (!root || limit <= 0) return { values: [], visited: 0 }
      const values: Array<T> = []
      const stack = [root]
      let visited = 0
      while (stack.length > 0 && values.length < limit) {
        if (!budget.consume()) break
        const node = stack.pop()!
        visited += 1
        if (!boundsIntersect(node.bounds, bounds)) continue
        if (node.entry) {
          values.push(node.entry.value)
          continue
        }
        stack.push(node.right, node.left)
      }
      return { values, visited }
    },
  }
}

function buildBoundsTree<T>(
  entries: Array<CanvasBoundsEntry<T>>,
  depth: number,
): CanvasBoundsTree<T> | null {
  if (entries.length === 0) return null
  if (entries.length === 1) return { bounds: entries[0]!.bounds, entry: entries[0]! }
  const axis = depth % 2 === 0 ? 'x' : 'y'
  entries.sort((left, right) => boundsCenter(left.bounds, axis) - boundsCenter(right.bounds, axis))
  const middle = entries.length >>> 1
  const left = buildBoundsTree(entries.slice(0, middle), depth + 1)!
  const right = buildBoundsTree(entries.slice(middle), depth + 1)!
  return { bounds: unionBounds(left.bounds, right.bounds), left, right }
}

function boundsCenter(bounds: CanvasBounds, axis: 'x' | 'y'): number {
  return bounds[axis] + bounds[axis === 'x' ? 'width' : 'height'] / 2
}

function unionBounds(left: CanvasBounds, right: CanvasBounds): CanvasBounds {
  const x = Math.min(left.x, right.x)
  const y = Math.min(left.y, right.y)
  const rightEdge = Math.max(left.x + left.width, right.x + right.width)
  const bottom = Math.max(left.y + left.height, right.y + right.height)
  return { x, y, width: rightEdge - x, height: bottom - y }
}

function boundsIntersect(left: CanvasBounds, right: CanvasBounds): boolean {
  return (
    left.x <= right.x + right.width &&
    left.x + left.width >= right.x &&
    left.y <= right.y + right.height &&
    left.y + left.height >= right.y
  )
}
