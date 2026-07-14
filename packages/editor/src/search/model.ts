import type { ResourceId } from '../resources/domain-id'
import type { BlockSearchResult } from '../../../../shared/search/types'
import type { AnyItem } from '../workspace/items'
import { createWorkspaceResource } from '../workspace/runtime'
import type { WorkspaceResource } from '../workspace/runtime'

export interface ItemSearchResult {
  itemId: ResourceId
  resource: WorkspaceResource
  item: AnyItem
  breadcrumb: string
  matchType: 'title' | 'body'
  matchText: string | null
}

export interface ItemSearchInput {
  query: string
}

export interface ItemSearchState {
  bodySearchError: unknown
  bodySearchPending: boolean
  recentItems: Array<ItemSearchResult>
  results: Array<ItemSearchResult>
}

export function buildItemSearchResults({
  bodyResults,
  getBreadcrumb,
  items,
  query,
}: {
  bodyResults: Array<BlockSearchResult> | undefined
  getBreadcrumb: (item: AnyItem) => string
  items: Array<AnyItem>
  query: string
}): Array<ItemSearchResult> {
  const lowerQuery = query.trim().toLowerCase()
  if (!lowerQuery) return []

  const itemsById = new Map(items.map((item) => [item.id, item] as const))
  const titleMatches = items.filter((item) => item.name.toLowerCase().includes(lowerQuery))
  const scored = titleMatches.map((item) => {
    const lower = item.name.toLowerCase()
    let score = 0
    if (lower === lowerQuery) score = 3
    else if (lower.startsWith(lowerQuery)) score = 2
    else score = 1
    return { item, score }
  })
  scored.sort((a, b) => b.score - a.score)

  const results: Array<ItemSearchResult> = []
  const titleMatchIds = new Set<ResourceId>()
  for (const { item } of scored) {
    titleMatchIds.add(item.id)
    results.push(toItemSearchResult(item, getBreadcrumb, 'title', null))
  }

  if (bodyResults) {
    const seenNotes = new Set<ResourceId>()
    for (const block of bodyResults) {
      if (titleMatchIds.has(block.noteId) || seenNotes.has(block.noteId)) continue
      const item = itemsById.get(block.noteId)
      if (!item) continue
      seenNotes.add(block.noteId)
      results.push(toItemSearchResult(item, getBreadcrumb, 'body', block.plainText))
    }
  }

  return results
}

export function toItemSearchResult(
  item: AnyItem,
  getBreadcrumb: (item: AnyItem) => string,
  matchType: ItemSearchResult['matchType'] = 'title',
  matchText: string | null = null,
): ItemSearchResult {
  return {
    itemId: item.id,
    resource: createWorkspaceResource(item.id),
    item,
    breadcrumb: getBreadcrumb(item),
    matchType,
    matchText,
  }
}

export function formatItemAncestorBreadcrumb(ancestors: ReadonlyArray<AnyItem>) {
  return ancestors.length > 0 ? `${ancestors.map((ancestor) => ancestor.name).join('/')}/` : ''
}
