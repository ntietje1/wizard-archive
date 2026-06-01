import type { LinkPathKind, LinkResolvableItem } from './types'

export function getItemPath<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  item: T,
  itemsMap: Map<TItemId, T>,
): Array<string> {
  const path: Array<string> = []
  let current: T | undefined = item
  const seen = new Set<TItemId>()

  while (current && !seen.has(current._id)) {
    seen.add(current._id)
    if (!current.name) {
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
  return pathSegments.map(normalizePathSegment)
}

function normalizePathSegment(pathSegment: string): string {
  return pathSegment.trim().toLowerCase()
}

function findChildByName<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  parentId: TItemId | null,
  name: string,
  allItems: Array<T>,
): T | undefined {
  const normalizedName = normalizePathSegment(name)

  return allItems.find((item) => {
    return item.parentId === parentId && normalizePathSegment(item.name) === normalizedName
  })
}

function matchesPathSuffix(
  normalizedFullPath: Array<string>,
  normalizedPath: Array<string>,
): boolean {
  if (normalizedFullPath.length < normalizedPath.length) return false

  const startIdx = normalizedFullPath.length - normalizedPath.length
  return normalizedPath.every((segment, i) => normalizedFullPath[startIdx + i] === segment)
}

function forEachMatchingItem<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  pathSegments: Array<string>,
  allItems: Array<T>,
  itemsMap: Map<TItemId, T>,
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

function rankMatches<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  matches: Array<T>,
  itemsMap: Map<TItemId, T>,
): Array<T> {
  const pathCache = new Map<TItemId, Array<string>>()
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

export function resolveItemByPath<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  pathSegments: Array<string>,
  allItems: Array<T>,
  itemsMap: Map<TItemId, T>,
): T | undefined {
  if (pathSegments.length === 0) return undefined

  return resolveAllByPath(pathSegments, allItems, itemsMap)[0]
}

export function resolveRelativeItemByPath<
  TItemId extends string,
  T extends LinkResolvableItem<TItemId>,
>(
  pathSegments: Array<string>,
  allItems: Array<T>,
  itemsMap: Map<TItemId, T>,
  sourceParentId: TItemId | null | undefined,
): T | undefined {
  if (pathSegments.length === 0 || sourceParentId === undefined) return undefined

  let currentParentId = sourceParentId

  for (let i = 0; i < pathSegments.length; i++) {
    const normalizedSegment = normalizePathSegment(pathSegments[i])
    if (!normalizedSegment) return undefined

    if (normalizedSegment === '.') {
      continue
    }

    if (normalizedSegment === '..') {
      if (currentParentId === null) {
        return undefined
      }

      const currentItem = itemsMap.get(currentParentId)
      if (!currentItem) {
        return undefined
      }
      currentParentId = currentItem.parentId
      continue
    }

    const child = findChildByName(currentParentId, pathSegments[i], allItems)
    if (!child) return undefined

    if (i === pathSegments.length - 1) {
      return child
    }

    currentParentId = child._id
  }

  return currentParentId ? itemsMap.get(currentParentId) : undefined
}

export function resolveParsedItemPath<
  TItemId extends string,
  T extends LinkResolvableItem<TItemId>,
>(
  pathKind: LinkPathKind,
  pathSegments: Array<string>,
  allItems: Array<T>,
  itemsMap: Map<TItemId, T>,
  sourceParentId?: TItemId | null,
): T | undefined {
  return pathKind === 'relative'
    ? resolveRelativeItemByPath(pathSegments, allItems, itemsMap, sourceParentId)
    : resolveItemByPath(pathSegments, allItems, itemsMap)
}

export function resolveAllByPath<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  pathSegments: Array<string>,
  allItems: Array<T>,
  itemsMap: Map<TItemId, T>,
): Array<T> {
  if (pathSegments.length === 0) return []

  const matches: Array<T> = []
  forEachMatchingItem(pathSegments, allItems, itemsMap, (item) => {
    matches.push(item)
  })

  return rankMatches(matches, itemsMap)
}

export function isPathUnique<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  pathSegments: Array<string>,
  allItems: Array<T>,
  itemsMap: Map<TItemId, T>,
): boolean {
  if (pathSegments.length === 0) return false

  let matchCount = 0
  forEachMatchingItem(pathSegments, allItems, itemsMap, () => {
    matchCount++
    return matchCount < 2
  })

  return matchCount === 1
}

export function getMinDisambiguationPath<
  TItemId extends string,
  T extends LinkResolvableItem<TItemId>,
>(item: T, allItems: Array<T>, itemsMap: Map<TItemId, T>): Array<string> {
  const fullPath = getItemPath(item, itemsMap)
  if (fullPath.length === 0) return item.name ? [item.name.trim()] : []

  for (let i = fullPath.length - 1; i >= 0; i--) {
    const partialPath = fullPath.slice(i)
    if (isPathUnique(partialPath, allItems, itemsMap)) {
      return partialPath
    }
  }

  return fullPath
}
