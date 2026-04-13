import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { BlockSearchResult } from 'convex/blocks/functions/searchBlocks'

export interface SearchResult {
  itemId: Id<'sidebarItems'>
  item: AnySidebarItem
  matchType: 'title' | 'body'
  matchText: string | null
}

export function mergeSearchResults(
  titleMatches: Array<AnySidebarItem>,
  bodyResults: Array<BlockSearchResult> | undefined,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
  query: string,
): Array<SearchResult> {
  const results: Array<SearchResult> = []
  const titleMatchIds = new Set<Id<'sidebarItems'>>()

  const lowerQuery = query.toLowerCase()

  const scored = titleMatches.map((item) => {
    const lower = item.name.toLowerCase()
    let score = 0
    if (lower === lowerQuery) score = 3
    else if (lower.startsWith(lowerQuery)) score = 2
    else score = 1
    return { item, score }
  })
  scored.sort((a, b) => b.score - a.score)

  for (const { item } of scored) {
    titleMatchIds.add(item._id)
    results.push({
      itemId: item._id,
      item,
      matchType: 'title',
      matchText: null,
    })
  }

  if (bodyResults) {
    const seenNotes = new Set<Id<'sidebarItems'>>()
    for (const block of bodyResults) {
      if (titleMatchIds.has(block.noteId) || seenNotes.has(block.noteId)) continue
      const item = itemsMap.get(block.noteId)
      if (!item) continue
      seenNotes.add(block.noteId)
      results.push({
        itemId: item._id,
        item,
        matchType: 'body',
        matchText: block.plainText,
      })
    }
  }

  return results
}
