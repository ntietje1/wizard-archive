import { pointsToPathD } from './stroke-node-model'
import type { StrokeNodeData } from './stroke-node-model'

type StrokePathCacheEntry = {
  points: StrokeNodeData['points']
  size: number
  detailPath: string
  detailBySize: Map<number, string>
}

const strokePathCache = new Map<string, StrokePathCacheEntry>()

export function clearStrokePathCache(nodeId: string) {
  strokePathCache.delete(nodeId)
}

export function clearAllStrokePathCache() {
  strokePathCache.clear()
}

export function getCachedStrokeDetailPath(
  nodeId: string,
  data: StrokeNodeData,
  size = data.size,
): string {
  const entry = getStrokePathCacheEntry(nodeId, data)
  const cached = entry.detailBySize.get(size)
  if (cached !== undefined) {
    return cached
  }

  const path = pointsToPathD(data.points, size)
  entry.detailBySize.set(size, path)
  return path
}

// Cache invalidation relies on strokePathCache callers replacing the immutable points array.
function getStrokePathCacheEntry(nodeId: string, data: StrokeNodeData): StrokePathCacheEntry {
  const existing = strokePathCache.get(nodeId)
  if (existing && existing.points === data.points && existing.size === data.size) {
    return existing
  }

  const detailPath = pointsToPathD(data.points, data.size)
  const entry = {
    points: data.points,
    size: data.size,
    detailPath,
    detailBySize: new Map([[data.size, detailPath]]),
  }
  strokePathCache.set(nodeId, entry)
  return entry
}
