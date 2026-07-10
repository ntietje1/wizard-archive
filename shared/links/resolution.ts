import type { LinkPathKind, LinkResolvableItem } from './types'
import { parseWikiLinkText } from './parsing'
import type { ParsedWikiLinkFields } from './parsing'

function getItemPath<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  item: T,
  itemsMap: ReadonlyMap<TItemId, T>,
): Array<string> {
  const path: Array<string> = []
  let current: T | undefined = item
  const seen = new Set<TItemId>()

  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    if (!current.name) {
      return []
    }
    path.unshift(current.name)
    current = current.parentId ? itemsMap.get(current.parentId) : undefined
  }

  return path
}

function comparePathSegments(a: ReadonlyArray<string>, b: ReadonlyArray<string>): number {
  const joinedA = a.join('/').toLowerCase()
  const joinedB = b.join('/').toLowerCase()
  return joinedA.localeCompare(joinedB)
}

function normalizePathSegments(pathSegments: ReadonlyArray<string>): Array<string> {
  return pathSegments.map(normalizePathSegment)
}

function normalizePathSegment(pathSegment: string): string {
  return pathSegment.trim().toLowerCase()
}

function findChildByName<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  parentId: TItemId | null,
  name: string,
  allItems: ReadonlyArray<T>,
): T | undefined {
  const normalizedName = normalizePathSegment(name)

  return allItems.find((item) => {
    return item.parentId === parentId && normalizePathSegment(item.name) === normalizedName
  })
}

function matchesPathSuffix(
  normalizedFullPath: ReadonlyArray<string>,
  normalizedPath: ReadonlyArray<string>,
): boolean {
  if (normalizedFullPath.length < normalizedPath.length) return false

  const startIdx = normalizedFullPath.length - normalizedPath.length
  return normalizedPath.every((segment, i) => normalizedFullPath[startIdx + i] === segment)
}

function forEachMatchingItem<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  pathSegments: ReadonlyArray<string>,
  allItems: ReadonlyArray<T>,
  itemsMap: ReadonlyMap<TItemId, T>,
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
  matches: ReadonlyArray<T>,
  itemsMap: ReadonlyMap<TItemId, T>,
): Array<T> {
  const pathCache = new Map<TItemId, Array<string>>()
  const getPath = (item: T) => {
    let path = pathCache.get(item.id)
    if (!path) {
      path = getItemPath(item, itemsMap)
      pathCache.set(item.id, path)
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

function resolveItemByPath<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  pathSegments: ReadonlyArray<string>,
  allItems: ReadonlyArray<T>,
  itemsMap: ReadonlyMap<TItemId, T>,
): T | undefined {
  if (pathSegments.length === 0) return undefined

  return resolveAllByPath(pathSegments, allItems, itemsMap)[0]
}

function resolveRelativeItemByPath<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  pathSegments: ReadonlyArray<string>,
  allItems: ReadonlyArray<T>,
  itemsMap: ReadonlyMap<TItemId, T>,
  sourceParentId: TItemId | null | undefined,
): T | undefined {
  if (pathSegments.length === 0 || sourceParentId === undefined) return undefined

  let currentParentId = sourceParentId

  for (let i = 0; i < pathSegments.length; i++) {
    const step = resolveRelativePathStep(pathSegments[i], currentParentId, allItems, itemsMap)
    if (!step) return undefined

    if (i === pathSegments.length - 1) {
      return step.item ?? (step.parentId ? itemsMap.get(step.parentId) : undefined)
    }

    currentParentId = step.parentId
  }

  return currentParentId ? itemsMap.get(currentParentId) : undefined
}

function resolveRelativePathStep<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  rawSegment: string,
  currentParentId: TItemId | null,
  allItems: ReadonlyArray<T>,
  itemsMap: ReadonlyMap<TItemId, T>,
): { item?: T; parentId: TItemId | null } | null {
  const normalizedSegment = normalizePathSegment(rawSegment)
  if (!normalizedSegment) return null
  if (normalizedSegment === '.') return { parentId: currentParentId }
  if (normalizedSegment === '..') return resolveRelativeParentStep(currentParentId, itemsMap)

  const child = findChildByName(currentParentId, rawSegment, allItems)
  return child ? { item: child, parentId: child.id } : null
}

function resolveRelativeParentStep<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  currentParentId: TItemId | null,
  itemsMap: ReadonlyMap<TItemId, T>,
): { parentId: TItemId | null } | null {
  if (currentParentId === null) return null

  const currentItem = itemsMap.get(currentParentId)
  return currentItem ? { parentId: currentItem.parentId } : null
}

export function resolveParsedItemPath<
  TItemId extends string,
  T extends LinkResolvableItem<TItemId>,
>(
  pathKind: LinkPathKind,
  pathSegments: ReadonlyArray<string>,
  allItems: ReadonlyArray<T>,
  itemsMap: ReadonlyMap<TItemId, T>,
  sourceParentId?: TItemId | null,
): T | undefined {
  return pathKind === 'relative'
    ? resolveRelativeItemByPath(pathSegments, allItems, itemsMap, sourceParentId)
    : resolveItemByPath(pathSegments, allItems, itemsMap)
}

export function parseResolvableWikiItemPath(text: string): ParsedWikiLinkFields | null {
  const parsed = parseWikiLinkText(text)
  if (
    parsed.displayName !== null ||
    parsed.headingPath.length > 0 ||
    parsed.itemPath.length === 0
  ) {
    return null
  }
  return parsed
}

function resolveAllByPath<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  pathSegments: ReadonlyArray<string>,
  allItems: ReadonlyArray<T>,
  itemsMap: ReadonlyMap<TItemId, T>,
): Array<T> {
  if (pathSegments.length === 0) return []

  const matches: Array<T> = []
  forEachMatchingItem(pathSegments, allItems, itemsMap, (item) => {
    matches.push(item)
  })

  return rankMatches(matches, itemsMap)
}

function isPathUnique<TItemId extends string, T extends LinkResolvableItem<TItemId>>(
  pathSegments: ReadonlyArray<string>,
  allItems: ReadonlyArray<T>,
  itemsMap: ReadonlyMap<TItemId, T>,
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
>(item: T, allItems: ReadonlyArray<T>, itemsMap: ReadonlyMap<TItemId, T>): Array<string> {
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
