import type { RefObject } from 'react'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { PanelRightIcon, SearchIcon, ExternalLinkIcon, XIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@wizard-archive/ui/shadcn/components/dialog'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { Button } from '@wizard-archive/ui/shadcn/components/button'
import { Separator } from '@wizard-archive/ui/shadcn/components/separator'
import { getPreviewFallbackCopy } from '../previews/fallback-policy'
import { ResourcePreviewSurface } from '../previews/resource-preview-surface'
import { StaticNotePreviewContent } from '../notes/embeds/static-note-preview-content'
import { getSidebarItemIcon } from '../workspace/sidebar/item-icons'
import { HighlightedText } from './highlighted-text'
import { SearchResultItem } from '@wizard-archive/ui/components/search-result-item'
import { WorkspaceContextMenu } from '../workspace/context-menu/context-menu'
import type { SidebarItemCreationCommand } from '../workspace/sidebar/creation-catalog'
import type { ItemSearchResult } from './model'
import type { SearchDialogController } from './dialog-controller'
import type { SearchDisplayItem } from './dialog-model'
import type { EmbeddedNoteContentSource } from '../notes/runtime'
import type { ResourceContentState } from '../filesystem/resource-content-source'

function SearchResultsPanel({
  showPreview,
  displayItems,
  status,
  emptyStateMessage,
  inlineStatusMessage,
  selectedIndex,
  selectedItemRef,
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
        <div id="search-results-list" role="listbox" aria-label="Search results" className="p-1">
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
                  role="option"
                  isSelected={index === selectedIndex}
                  onClick={() => onSelect(displayItem)}
                  onMouseEnter={() => onHover(index)}
                />
              ) : (
                <WorkspaceContextMenu viewContext="search-results" item={displayItem.result.item}>
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
                    subtitle={displayItem.result.breadcrumb || undefined}
                    detail={
                      hasQuery &&
                      displayItem.result.matchType === 'body' &&
                      displayItem.result.matchText ? (
                        <HighlightedText text={displayItem.result.matchText} query={query} />
                      ) : undefined
                    }
                    isSelected={index === selectedIndex}
                    role="option"
                    onClick={() => onSelect(displayItem)}
                    onMouseEnter={() => onHover(index)}
                  />
                </WorkspaceContextMenu>
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
  previewState,
  embeddedNoteContentSource,
  onOpen,
}: {
  hasQuery: boolean
  selectedResult?: ItemSearchResult
  selectedCommand?: SidebarItemCreationCommand
  previewState: ResourceContentState
  embeddedNoteContentSource: EmbeddedNoteContentSource
  onOpen: (result: ItemSearchResult) => void
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
          <WorkspaceContextMenu viewContext="search-results" item={selectedResult.item}>
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
          </WorkspaceContextMenu>
          <div className="flex-1 min-h-0">
            {previewState.status === 'loading' || previewState.status === 'idle' ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                {getPreviewFallbackCopy({ surface: 'search', reason: 'loading' })}
              </div>
            ) : previewState.status === 'error' ? (
              <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground p-4">
                {getPreviewFallbackCopy({ surface: 'search', reason: 'loadError' })}
              </div>
            ) : previewState.status === 'ready' ? (
              <ResourcePreviewSurface
                item={previewState.item}
                folderChildren={previewState.folderChildren}
                renderPreview={(input) => {
                  if (input.kind !== 'note') return undefined
                  return (
                    <StaticNotePreviewContent
                      note={input.item}
                      allowInnerScroll={input.allowInnerScroll}
                      constrained={false}
                      embeddedNoteContentSource={embeddedNoteContentSource}
                      fillAvailableHeight={false}
                    />
                  )
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                {getPreviewFallbackCopy({ surface: 'search', reason: 'noPreview' })}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          {hasQuery ? getPreviewFallbackCopy({ surface: 'search', reason: 'selectResult' }) : ''}
        </div>
      )}
    </div>
  )
}

export function SearchDialog({
  controller,
  embeddedNoteContentSource,
  previewState,
}: {
  controller: SearchDialogController
  embeddedNoteContentSource: EmbeddedNoteContentSource
  previewState: ResourceContentState
}) {
  const {
    close,
    displayItems,
    emptyStateMessage,
    handleKeyDown,
    handleOpenChange,
    hasQuery,
    inlineStatusMessage,
    isOpen,
    openResult,
    query,
    searchQuery,
    selectedCommand,
    selectedIndex,
    selectedItemRef,
    selectedResult,
    selectDisplayItem,
    setQuery,
    setSelectedIndex,
    showPreview,
    status,
    togglePreview,
  } = controller

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
            role="combobox"
            aria-expanded={displayItems.length > 0}
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
            aria-pressed={showPreview}
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
            query={searchQuery}
            onSelect={selectDisplayItem}
            onHover={setSelectedIndex}
          />

          {showPreview && (
            <SearchPreviewPanel
              hasQuery={hasQuery}
              selectedResult={selectedResult}
              selectedCommand={selectedCommand}
              previewState={previewState}
              embeddedNoteContentSource={embeddedNoteContentSource}
              onOpen={openResult}
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
