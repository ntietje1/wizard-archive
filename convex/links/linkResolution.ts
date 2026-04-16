import type { Id } from '../_generated/dataModel'
import { logger } from '../common/logger'

export interface LinkResolvableItem {
  _id: Id<'sidebarItems'>
  name: string
  parentId: Id<'sidebarItems'> | null
}

export function getItemPath<T extends LinkResolvableItem>(
  item: T,
  itemsMap: Map<Id<'sidebarItems'>, T>,
): Array<string> {
  const path: Array<string> = []
  let current: T | undefined = item
  const seen = new Set<Id<'sidebarItems'>>()

  while (current && !seen.has(current._id)) {
    seen.add(current._id)
    if (!current.name) {
      logger.warn('[getItemPath] Encountered item with empty name')
      return []
    }
    path.unshift(current.name)
    current = current.parentId ? itemsMap.get(current.parentId) : undefined
  }

  return path
}

function comparePathSegments(a: Array<string>, b: Array<string>): number {
  const joinedA = a.join('/').toLowerCase()
  const joinedB = b.join('/').toLowerCase()
  return joinedA.localeCompare(joinedB)
}

function normalizePathSegments(pathSegments: Array<string>): Array<string> {
  return pathSegments.map((segment) => segment.trim().toLowerCase())
}

function matchesPathSuffix(
  normalizedFullPath: Array<string>,
  normalizedPath: Array<string>,
): boolean {
  if (normalizedFullPath.length < normalizedPath.length) return false

  const startIdx = normalizedFullPath.length - normalizedPath.length
  return normalizedPath.every((segment, i) => normalizedFullPath[startIdx + i] === segment)
}

function forEachMatchingItem<T extends LinkResolvableItem>(
  pathSegments: Array<string>,
  allItems: Array<T>,
  itemsMap: Map<Id<'sidebarItems'>, T>,
  onMatch: (item: T) => boolean | void,
): void {
  const normalizedPath = normalizePathSegments(pathSegments)
  const leaf = normalizedPath[normalizedPath.length - 1]

  for (const item of allItems) {
    const normalizedItemPath = normalizePathSegments(getItemPath(item, itemsMap))
    const normalizedLeaf = normalizedItemPath[normalizedItemPath.length - 1]
    if (leaf && normalizedLeaf !== leaf) continue
    if (!matchesPathSuffix(normalizedItemPath, normalizedPath)) continue
    if (onMatch(item) === false) return
  }
}

function rankMatches<T extends LinkResolvableItem>(
  matches: Array<T>,
  itemsMap: Map<Id<'sidebarItems'>, T>,
): Array<T> {
  const pathCache = new Map<Id<'sidebarItems'>, Array<string>>()
  const getPath = (item: T) => {
    let path = pathCache.get(item._id)
    if (!path) {
      path = getItemPath(item, itemsMap)
      pathCache.set(item._id, path)
    }
    return path
  }

  return [...matches].sort((a, b) => {
    const pathA = getPath(a)
    const pathB = getPath(b)

    if (pathA.length !== pathB.length) {
      return pathA.length - pathB.length
    }

    return comparePathSegments(pathA, pathB)
  })
}

export function resolveItemByPath<T extends LinkResolvableItem>(
  pathSegments: Array<string>,
  allItems: Array<T>,
  itemsMap: Map<Id<'sidebarItems'>, T>,
): T | undefined {
  if (pathSegments.length === 0) return undefined

  return resolveAllByPath(pathSegments, allItems, itemsMap)[0]
}

export function resolveAllByPath<T extends LinkResolvableItem>(
  pathSegments: Array<string>,
  allItems: Array<T>,
  itemsMap: Map<Id<'sidebarItems'>, T>,
): Array<T> {
  if (pathSegments.length === 0) return []

  const matches: Array<T> = []
  forEachMatchingItem(pathSegments, allItems, itemsMap, (item) => {
    matches.push(item)
  })

  return rankMatches(matches, itemsMap)
}

export function isPathUnique<T extends LinkResolvableItem>(
  pathSegments: Array<string>,
  allItems: Array<T>,
  itemsMap: Map<Id<'sidebarItems'>, T>,
): boolean {
  if (pathSegments.length === 0) return false

  let matchCount = 0
  forEachMatchingItem(pathSegments, allItems, itemsMap, () => {
    matchCount++
    return matchCount < 2
  })

  return matchCount === 1
}

export function getMinDisambiguationPath<T extends LinkResolvableItem>(
  item: T,
  allItems: Array<T>,
  itemsMap: Map<Id<'sidebarItems'>, T>,
): Array<string> {
  const fullPath = getItemPath(item, itemsMap)
  if (fullPath.length === 0) return item.name ? [item.name] : []

  for (let i = fullPath.length - 1; i >= 0; i--) {
    const partialPath = fullPath.slice(i)
    if (isPathUnique(partialPath, allItems, itemsMap)) {
      return partialPath
    }
  }

  return fullPath
}
