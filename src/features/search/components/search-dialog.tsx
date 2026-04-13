import { useEffect, useRef, useState } from 'react'
import { cn } from '~/features/shadcn/lib/utils'
import { PanelRightIcon, SearchIcon, ExternalLinkIcon, XIcon } from 'lucide-react'
import { api } from 'convex/_generated/api'
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
import { ItemPreviewContent } from '~/features/editor/components/item-preview-content'
import { useSearchStore } from '../stores/search-store'
import { useFilteredSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useSidebarItemById } from '~/features/sidebar/hooks/useSidebarItemById'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { buildBreadcrumbs } from '~/features/sidebar/utils/sidebar-item-utils'
import { HighlightedText } from './highlighted-text'
import { SearchResultItem } from './search-result-item'
import { mergeSearchResults } from '../utils/merge-search-results'
import { useRecentItems } from '../hooks/use-recent-items'
import type { SearchResult } from '../utils/merge-search-results'

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export function SearchDialog() {
  const { isOpen, query, close, setQuery, open, showPreview, togglePreview } = useSearchStore()
  const { data: items, itemsMap } = useFilteredSidebarItems()
  const { navigateToItem } = useEditorNavigation()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedItemRef = useRef<HTMLDivElement>(null)
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

  const titleMatches = debouncedQuery.trim()
    ? items.filter((item) => item.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
    : []

  const bodyQuery = useCampaignQuery(
    api.blocks.queries.searchBlocks,
    debouncedQuery.trim() ? { query: debouncedQuery } : 'skip',
  )

  const recentItems = useRecentItems()

  const results = debouncedQuery.trim()
    ? mergeSearchResults(titleMatches, bodyQuery.data ?? undefined, itemsMap, debouncedQuery)
    : []

  const hasQuery = debouncedQuery.trim().length > 0
  const displayItems = hasQuery ? results : recentItems

  const prevQueryRef = useRef(debouncedQuery)
  if (prevQueryRef.current !== debouncedQuery) {
    prevQueryRef.current = debouncedQuery
    if (selectedIndex !== 0) setSelectedIndex(0)
  }

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const selectedResult: SearchResult | undefined = displayItems[selectedIndex]

  const { data: selectedContentItem, isLoading: isPreviewLoading } = useSidebarItemById(
    selectedResult?.item._id,
  )

  const handleSelect = (result: SearchResult) => {
    void navigateToItem(result.item.slug)
    close()
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
    } else if (e.key === 'Enter' && selectedResult) {
      e.preventDefault()
      handleSelect(selectedResult)
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
            role="combobox"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            aria-label="Search"
            aria-expanded={true}
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
          <div
            className={cn(
              showPreview ? 'w-1/2 border-r border-border' : 'w-full',
              'flex flex-col min-h-0',
            )}
          >
            <div
              role="status"
              aria-live="polite"
              className="px-3 py-1.5 text-xs text-muted-foreground font-medium"
            >
              {hasQuery
                ? results.length > 0
                  ? `${results.length} result${results.length === 1 ? '' : 's'}`
                  : 'No results'
                : recentItems.length > 0
                  ? 'Recent'
                  : ''}
            </div>
            <ScrollArea className="flex-1">
              <div
                id="search-results-list"
                role="listbox"
                aria-label="Search results"
                className="p-1"
              >
                {!hasQuery && recentItems.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Type to search your vault
                  </div>
                )}
                {hasQuery && results.length === 0 && !bodyQuery.isPending && (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No results found
                  </div>
                )}
                {displayItems.map((result, index) => (
                  <div
                    key={`${result.itemId}-${result.matchType}`}
                    ref={index === selectedIndex ? selectedItemRef : undefined}
                  >
                    <SearchResultItem
                      id={`search-result-${index}`}
                      icon={getSidebarItemIcon(result.item)}
                      title={
                        hasQuery && result.matchType === 'title' ? (
                          <HighlightedText text={result.item.name} query={debouncedQuery} />
                        ) : (
                          result.item.name
                        )
                      }
                      subtitle={buildBreadcrumbs(result.item, itemsMap) || undefined}
                      detail={
                        hasQuery && result.matchType === 'body' && result.matchText ? (
                          <HighlightedText text={result.matchText} query={debouncedQuery} />
                        ) : undefined
                      }
                      isSelected={index === selectedIndex}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {showPreview && (
            <div className="w-1/2 flex flex-col min-h-0">
              {selectedResult ? (
                <>
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <span className="text-sm font-medium truncate">{selectedResult.item.name}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleSelect(selectedResult)}
                      aria-label="Open result"
                    >
                      <ExternalLinkIcon className="size-3.5" />
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0">
                    {isPreviewLoading ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                        Loading preview...
                      </div>
                    ) : selectedContentItem ? (
                      <ItemPreviewContent item={selectedContentItem} />
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
          )}
        </div>

        <Separator />
        <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">↵</kbd> Open
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Esc</kbd> Close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
