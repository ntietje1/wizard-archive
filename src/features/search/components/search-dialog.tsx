import { useEffect, useRef, useState } from 'react'
import { SearchIcon, ExternalLinkIcon } from 'lucide-react'
import { api } from 'convex/_generated/api'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
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
import { NoteContent } from '~/features/editor/components/note-content'
import { useSearchStore } from '../stores/search-store'
import { useFilteredSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { buildBreadcrumbs } from '~/features/sidebar/utils/sidebar-item-utils'
import { HighlightedText } from './highlighted-text'
import { SearchResultItem } from './search-result-item'
import { mergeSearchResults } from '../utils/merge-search-results'
import type { SearchResult } from '../utils/merge-search-results'
import type { Id } from 'convex/_generated/dataModel'

export function SearchDialog() {
  const { isOpen, query, close, setQuery, open } = useSearchStore()
  const { data: items, itemsMap } = useFilteredSidebarItems()
  const { navigateToItem } = useEditorNavigation()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedItemRef = useRef<HTMLDivElement>(null)
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('')
      return
    }
    const timer = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(timer)
  }, [query])

  const titleMatches = debouncedQuery.trim()
    ? items.filter((item) => item.name.toLowerCase().includes(debouncedQuery.toLowerCase()))
    : []

  const bodyQuery = useCampaignQuery(
    api.blocks.queries.searchBlocks,
    debouncedQuery.trim() ? { query: debouncedQuery } : 'skip',
  )

  const results = debouncedQuery.trim()
    ? mergeSearchResults(titleMatches, bodyQuery.data ?? undefined, itemsMap, debouncedQuery)
    : []

  useEffect(() => {
    setSelectedIndex(0)
  }, [debouncedQuery])

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const selectedResult: SearchResult | undefined = results[selectedIndex]
  const selectedNoteId =
    selectedResult?.item.type === SIDEBAR_ITEM_TYPES.notes ? selectedResult.item._id : null

  const notePreviewQuery = useCampaignQuery(
    api.notes.queries.getNote,
    selectedNoteId ? { noteId: selectedNoteId as Id<'sidebarItems'> } : 'skip',
  )

  const handleSelect = (result: SearchResult) => {
    void navigateToItem(result.item.slug)
    close()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return
    const maxIndex = results.length - 1
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

  const hasQuery = debouncedQuery.trim().length > 0

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search</DialogTitle>
        <DialogDescription>Search your vault</DialogDescription>
      </DialogHeader>
      <DialogContent
        className="sm:max-w-4xl! h-[min(80vh,600px)] flex flex-col gap-0 p-0 overflow-hidden"
        showCloseButton={false}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes..."
            aria-label="Search notes"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="w-1/2 flex flex-col min-h-0 border-r border-border">
            {hasQuery && (
              <div className="px-3 py-1.5 text-xs text-muted-foreground font-medium">
                {results.length > 0
                  ? `${results.length} result${results.length === 1 ? '' : 's'}`
                  : 'No results'}
              </div>
            )}
            <ScrollArea className="flex-1">
              <div className="p-1">
                {!hasQuery && (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Type to search your vault
                  </div>
                )}
                {hasQuery && results.length === 0 && !bodyQuery.isPending && (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No results found
                  </div>
                )}
                {results.map((result, index) => (
                  <div
                    key={`${result.itemId}-${result.matchType}`}
                    ref={index === selectedIndex ? selectedItemRef : undefined}
                  >
                    <SearchResultItem
                      icon={getSidebarItemIcon(result.item)}
                      title={
                        result.matchType === 'title' ? (
                          <HighlightedText text={result.item.name} query={debouncedQuery} />
                        ) : (
                          result.item.name
                        )
                      }
                      subtitle={buildBreadcrumbs(result.item, itemsMap) || undefined}
                      detail={
                        result.matchType === 'body' && result.matchText ? (
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

          <div className="w-1/2 flex flex-col min-h-0">
            {selectedResult ? (
              <>
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-sm font-medium truncate">{selectedResult.item.name}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleSelect(selectedResult)}
                  >
                    <ExternalLinkIcon className="size-3.5" />
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  {selectedNoteId && notePreviewQuery.data ? (
                    <div className="pointer-events-none text-sm">
                      <NoteContent content={notePreviewQuery.data.content} editable={false} />
                    </div>
                  ) : (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      {!selectedNoteId
                        ? 'Preview not available for this item type'
                        : notePreviewQuery.isError
                          ? 'Failed to load preview'
                          : 'Loading preview...'}
                    </div>
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                {hasQuery ? 'Select a result to preview' : ''}
              </div>
            )}
          </div>
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
