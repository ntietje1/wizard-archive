import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { cn } from '~/features/shadcn/lib/utils'
import { PanelRightIcon, SearchIcon, ExternalLinkIcon, XIcon } from 'lucide-react'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/features/shadcn/components/dialog'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { Button } from '~/features/shadcn/components/button'
import { Separator } from '~/features/shadcn/components/separator'
import { SidebarItemPreviewContent } from '~/features/previews/components/sidebar-item-preview-content'
import { useSearchStore } from '../stores/search-store'
import { useFilteredSidebarItems } from '~/features/sidebar/hooks/useFilteredSidebarItems'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { buildBreadcrumbs } from '~/features/sidebar/utils/sidebar-item-utils'
import { HighlightedText } from './highlighted-text'
import { SearchResultItem } from './search-result-item'
import { mergeSearchResults } from '../utils/merge-search-results'
import { useRecentItems } from '../hooks/use-recent-items'
import type { SearchResult } from '../utils/merge-search-results'
import { useDebouncedValue } from '~/shared/hooks/useDebouncedValue'
import type { AnySidebarItem, AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'
import { SIDEBAR_ITEM_CREATION_COMMANDS } from '~/features/sidebar/sidebar-item-creation-catalog'
import type { SidebarItemCreationCommand } from '~/features/sidebar/sidebar-item-creation-catalog'
import type { BlockSearchResult } from 'shared/search/types'
import { handleError } from '~/shared/utils/logger'

type SearchDisplayItem =
  | { kind: 'command'; command: SidebarItemCreationCommand }
  | { kind: 'item'; result: SearchResult }

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

function getTitleMatches(items: Array<AnySidebarItem>, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return []
  return items.filter((item) => item.name.toLowerCase().includes(normalizedQuery))
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
  results: Array<SearchResult>
  recentItems: Array<SearchResult>
}): Array<SearchDisplayItem> {
  if (!hasQuery) return recentItems.map((result) => ({ kind: 'item', result }))
  return [
    ...matchingCommands.map((command) => ({ kind: 'command' as const, command })),
    ...results.map((result) => ({ kind: 'item' as const, result })),
  ]
}

function getSearchDialogModel({
  query,
  items,
  itemsMap,
  bodyResults,
  bodySearchPending,
  bodySearchError,
  recentItems,
}: {
  query: string
  items: Array<AnySidebarItem>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
  bodyResults: Array<BlockSearchResult> | undefined
  bodySearchPending: boolean
  bodySearchError: unknown
  recentItems: Array<SearchResult>
}) {
  const hasQuery = query.trim().length > 0
  const titleMatches = getTitleMatches(items, query)
  const results = hasQuery ? mergeSearchResults(titleMatches, bodyResults, itemsMap, query) : []
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

function SearchResultsPanel({
  showPreview,
  displayItems,
  status,
  emptyStateMessage,
  inlineStatusMessage,
  selectedIndex,
  selectedItemRef,
  itemsMap,
  query,
  onSelect,
  onHover,
}: {
  showPreview: boolean
  displayItems: Array<SearchDisplayItem>
  status: string
  emptyStateMessage?: string
  inlineStatusMessage?: string
  selectedIndex: number
  selectedItemRef: RefObject<HTMLDivElement | null>
  itemsMap: Parameters<typeof buildBreadcrumbs>[1]
  query: string
  onSelect: (result: SearchDisplayItem) => void
  onHover: (index: number) => void
}) {
  const hasQuery = query.trim().length > 0

  return (
    <div
      className={cn(
        showPreview ? 'w-1/2 border-r border-border' : 'w-full',
        'flex flex-col min-h-0',
      )}
    >
      <output aria-live="polite" className="px-3 py-1.5 text-xs text-muted-foreground font-medium">
        {status}
      </output>
      <ScrollArea className="flex-1">
        <div id="search-results-list" aria-label="Search results" className="p-1">
          {emptyStateMessage && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {emptyStateMessage}
            </div>
          )}
          {inlineStatusMessage && (
            <div className="px-3 py-2 text-xs text-destructive">{inlineStatusMessage}</div>
          )}
          {displayItems.map((displayItem, index) => (
            <div
              key={
                displayItem.kind === 'command'
                  ? displayItem.command.id
                  : `${displayItem.result.itemId}-${displayItem.result.matchType}`
              }
              ref={index === selectedIndex ? selectedItemRef : undefined}
            >
              {displayItem.kind === 'command' ? (
                <SearchResultItem
                  id={`search-result-${index}`}
                  icon={displayItem.command.icon}
                  title={`New ${displayItem.command.label}`}
                  subtitle="Create at top level"
                  badge="Command"
                  isSelected={index === selectedIndex}
                  onClick={() => onSelect(displayItem)}
                  onMouseEnter={() => onHover(index)}
                />
              ) : (
                <SearchResultItem
                  id={`search-result-${index}`}
                  icon={getSidebarItemIcon(displayItem.result.item)}
                  title={
                    hasQuery && displayItem.result.matchType === 'title' ? (
                      <HighlightedText text={displayItem.result.item.name} query={query} />
                    ) : (
                      displayItem.result.item.name
                    )
                  }
                  subtitle={buildBreadcrumbs(displayItem.result.item, itemsMap) || undefined}
                  detail={
                    hasQuery &&
                    displayItem.result.matchType === 'body' &&
                    displayItem.result.matchText ? (
                      <HighlightedText text={displayItem.result.matchText} query={query} />
                    ) : undefined
                  }
                  isSelected={index === selectedIndex}
                  onClick={() => onSelect(displayItem)}
                  onMouseEnter={() => onHover(index)}
                />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function SearchPreviewPanel({
  hasQuery,
  selectedResult,
  selectedCommand,
  selectedContentItem,
  isPreviewLoading,
  previewError,
  onOpen,
}: {
  hasQuery: boolean
  selectedResult?: SearchResult
  selectedCommand?: SidebarItemCreationCommand
  selectedContentItem?: AnySidebarItemWithContent
  isPreviewLoading: boolean
  previewError: unknown
  onOpen: (result: SearchResult) => void
}) {
  if (selectedCommand) {
    const Icon = selectedCommand.icon
    return (
      <div className="w-1/2 flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">New {selectedCommand.label}</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Create at top level
        </div>
      </div>
    )
  }

  return (
    <div className="w-1/2 flex flex-col min-h-0">
      {selectedResult ? (
        <>
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-medium truncate">{selectedResult.item.name}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => onOpen(selectedResult)}
              aria-label="Open result"
            >
              <ExternalLinkIcon className="size-3.5" />
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            {isPreviewLoading ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Loading preview…
              </div>
            ) : previewError ? (
              <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground p-4">
                Failed to load preview. You can still open this result.
              </div>
            ) : selectedContentItem ? (
              <SidebarItemPreviewContent item={selectedContentItem} />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Failed to load preview
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          {hasQuery ? 'Select a result to preview' : ''}
        </div>
      )}
    </div>
  )
}

export function SearchDialog() {
  const { isOpen, query, close, setQuery, open, showPreview, togglePreview } = useSearchStore()
  const { data: items, itemsMap } = useFilteredSidebarItems()
  const {
    commands: { createSidebarItem, openItem },
  } = useSidebarWorkspaceSource()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedItemRef = useRef<HTMLDivElement>(null)
  const runningCommandIdRef = useRef<SidebarItemCreationCommand['id'] | null>(null)
  const debouncedQuery = useDebouncedValue(query, 200)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) {
          close()
        } else {
          open()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, open, close])

  const bodyQuery = useCampaignQuery(
    api.blocks.queries.searchBlocks,
    debouncedQuery.trim() ? { query: debouncedQuery } : 'skip',
  )

  const recentItems = useRecentItems(items)
  const { displayItems, emptyStateMessage, hasQuery, inlineStatusMessage, status } =
    getSearchDialogModel({
      query: debouncedQuery,
      items,
      itemsMap,
      bodyResults: bodyQuery.data ?? undefined,
      bodySearchPending: bodyQuery.isPending,
      bodySearchError: bodyQuery.error,
      recentItems,
    })

  const prevQueryRef = useRef(debouncedQuery)
  if (prevQueryRef.current !== debouncedQuery) {
    prevQueryRef.current = debouncedQuery
    if (selectedIndex !== 0) setSelectedIndex(0)
  }

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const selectedDisplayItem = displayItems[selectedIndex]
  const selectedResult: SearchResult | undefined =
    selectedDisplayItem?.kind === 'item' ? selectedDisplayItem.result : undefined
  const selectedCommand: SidebarItemCreationCommand | undefined =
    selectedDisplayItem?.kind === 'command' ? selectedDisplayItem.command : undefined

  const {
    data: selectedContentItem,
    isLoading: isPreviewLoading,
    error: previewError,
  } = useSidebarItemById(selectedResult?.item._id)

  const handleSelect = (result: SearchResult) => {
    void openItem(result.item.slug)
    close()
  }

  const handleSelectDisplayItem = (displayItem: SearchDisplayItem) => {
    if (displayItem.kind === 'item') {
      handleSelect(displayItem.result)
      return
    }
    if (runningCommandIdRef.current !== null) return

    const { command } = displayItem
    runningCommandIdRef.current = command.id
    void (async () => {
      try {
        const result = await createSidebarItem({ type: command.type, parentId: null })
        if (result) close()
      } catch (error) {
        handleError(error, command.failureMessage)
      } finally {
        runningCommandIdRef.current = null
      }
    })()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (displayItems.length === 0) return
    const maxIndex = displayItems.length - 1
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, maxIndex))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && selectedDisplayItem) {
      e.preventDefault()
      handleSelectDisplayItem(selectedDisplayItem)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) close()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          showPreview ? 'sm:max-w-4xl!' : 'sm:max-w-xl!',
          'h-[min(80vh,600px)] flex flex-col gap-0 p-0 overflow-hidden',
        )}
        showCloseButton={false}
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Search your vault</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label="Search"
            aria-controls="search-results-list"
            aria-activedescendant={
              displayItems.length > 0 ? `search-result-${selectedIndex}` : undefined
            }
            aria-autocomplete="list"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={togglePreview}
            aria-label="Toggle preview"
          >
            <PanelRightIcon className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close">
            <XIcon className="size-3.5" />
          </Button>
        </div>

        <div className="flex flex-1 min-h-0">
          <SearchResultsPanel
            showPreview={showPreview}
            displayItems={displayItems}
            status={status}
            emptyStateMessage={emptyStateMessage}
            inlineStatusMessage={inlineStatusMessage}
            selectedIndex={selectedIndex}
            selectedItemRef={selectedItemRef}
            itemsMap={itemsMap}
            query={debouncedQuery}
            onSelect={handleSelectDisplayItem}
            onHover={setSelectedIndex}
          />

          {showPreview && (
            <SearchPreviewPanel
              hasQuery={hasQuery}
              selectedResult={selectedResult}
              selectedCommand={selectedCommand}
              selectedContentItem={selectedContentItem}
              isPreviewLoading={isPreviewLoading}
              previewError={previewError}
              onOpen={handleSelect}
            />
          )}
        </div>

        <Separator />
        <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">↵</kbd> Open / Run
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Esc</kbd> Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
