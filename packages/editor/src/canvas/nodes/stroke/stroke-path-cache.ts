import { pointsToPathD } from './stroke-node-model'
import type { StrokeNodeData } from './stroke-node-model'

type StrokePathCacheEntry = {
  points: StrokeNodeData['points']
  detailBySize: Map<number, string>
}

const MAX_STROKE_DETAIL_PATHS_PER_NODE = 32
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
  trimStrokeDetailPathCache(entry.detailBySize)
  return path
}

function trimStrokeDetailPathCache(detailBySize: Map<number, string>) {
  while (detailBySize.size > MAX_STROKE_DETAIL_PATHS_PER_NODE) {
    const oldestSize = detailBySize.keys().next().value
    if (oldestSize === undefined) {
      return
    }
    detailBySize.delete(oldestSize)
  }
}

function getStrokePathCacheEntry(nodeId: string, data: StrokeNodeData): StrokePathCacheEntry {
  const existing = strokePathCache.get(nodeId)
  if (existing && existing.points === data.points) {
    return existing
  }

  const entry = {
    points: data.points,
    detailBySize: new Map<number, string>(),
  }
  strokePathCache.set(nodeId, entry)
  return entry
}
