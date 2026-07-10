import { SIDEBAR_ITEM_CREATION_COMMANDS } from '../workspace/sidebar/creation-catalog'
import type { SidebarItemCreationCommand } from '../workspace/sidebar/creation-catalog'
import type { ItemSearchResult } from './model'

export type SearchDisplayItem =
  | { kind: 'command'; command: SidebarItemCreationCommand }
  | { kind: 'item'; result: ItemSearchResult }

function getMatchingCreationCommands(query: string): Array<SidebarItemCreationCommand> {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  return SIDEBAR_ITEM_CREATION_COMMANDS.filter((command) => {
    const commandText = `new ${command.label} create ${command.label} ${command.key}`.toLowerCase()
    return terms.every((term) => commandText.includes(term))
  })
}

function getSearchStatus({
  hasQuery,
  itemResultCount,
  recentItemCount,
  commandResultCount,
}: {
  hasQuery: boolean
  itemResultCount: number
  recentItemCount: number
  commandResultCount: number
}) {
  if (!hasQuery) return recentItemCount > 0 ? 'Recent' : ''

  const total = itemResultCount + commandResultCount
  return total > 0 ? `${total} result${total === 1 ? '' : 's'}` : 'No results'
}

function getSearchEmptyStateMessage({
  hasQuery,
  recentItemCount,
  displayItemCount,
  bodySearchPending,
  bodySearchFailed,
}: {
  hasQuery: boolean
  recentItemCount: number
  displayItemCount: number
  bodySearchPending: boolean
  bodySearchFailed: boolean
}) {
  if (!hasQuery && recentItemCount === 0) return 'Type to search your vault'
  if (!hasQuery || displayItemCount > 0 || bodySearchPending) return undefined
  return bodySearchFailed ? 'Body search failed' : 'No results found'
}

function getSearchInlineStatusMessage({
  hasQuery,
  bodySearchFailed,
  displayItemCount,
  itemResultCount,
}: {
  hasQuery: boolean
  bodySearchFailed: boolean
  displayItemCount: number
  itemResultCount: number
}) {
  if (!hasQuery || !bodySearchFailed || displayItemCount === 0) return undefined
  return itemResultCount > 0
    ? 'Body search failed. Showing title matches only.'
    : 'Body search failed'
}

function getDisplayItems({
  hasQuery,
  matchingCommands,
  results,
  recentItems,
}: {
  hasQuery: boolean
  matchingCommands: Array<SidebarItemCreationCommand>
  results: Array<ItemSearchResult>
  recentItems: Array<ItemSearchResult>
}): Array<SearchDisplayItem> {
  if (!hasQuery) return recentItems.map((result) => ({ kind: 'item', result }))
  return [
    ...matchingCommands.map((command) => ({ kind: 'command' as const, command })),
    ...results.map((result) => ({ kind: 'item' as const, result })),
  ]
}

export function getSearchDialogModel({
  query,
  results,
  bodySearchPending,
  bodySearchError,
  recentItems,
}: {
  query: string
  results: Array<ItemSearchResult>
  bodySearchPending: boolean
  bodySearchError: unknown
  recentItems: Array<ItemSearchResult>
}) {
  const hasQuery = query.trim().length > 0
  const matchingCommands = hasQuery ? getMatchingCreationCommands(query) : []
  const displayItems = getDisplayItems({ hasQuery, matchingCommands, results, recentItems })
  const bodySearchFailed = Boolean(bodySearchError)

  return {
    displayItems,
    hasQuery,
    results,
    status: getSearchStatus({
      hasQuery,
      itemResultCount: results.length,
      recentItemCount: recentItems.length,
      commandResultCount: matchingCommands.length,
    }),
    emptyStateMessage: getSearchEmptyStateMessage({
      hasQuery,
      recentItemCount: recentItems.length,
      displayItemCount: displayItems.length,
      bodySearchPending,
      bodySearchFailed,
    }),
    inlineStatusMessage: getSearchInlineStatusMessage({
      hasQuery,
      bodySearchFailed,
      displayItemCount: displayItems.length,
      itemResultCount: results.length,
    }),
  }
}
