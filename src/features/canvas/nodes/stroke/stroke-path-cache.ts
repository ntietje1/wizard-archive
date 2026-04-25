import { pointsToPathD } from './stroke-node-model'
import type { StrokeNodeData } from './stroke-node-model'

type StrokePathCacheEntry = {
  points: StrokeNodeData['points']
  size: number
  detailPath: string
  detailBySize: Map<number, string>
}

const strokePathCache = new Map<string, StrokePathCacheEntry>()

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

  const path = size === entry.size ? entry.detailPath : pointsToPathD(data.points, size)
  entry.detailBySize.set(size, path)
  return path
}

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
