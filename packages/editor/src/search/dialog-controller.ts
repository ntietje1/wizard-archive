import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { MaybePromise } from '../../../../shared/common/async'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceKind } from '../workspace/resource-contract'
import type { WorkspaceNavigation } from '../workspace/runtime'
import type { SidebarItemCreationCommand } from '../workspace/sidebar/creation-catalog'
import type { ItemSearchResult, ItemSearchState } from './model'
import type { FileSystemCreateItemResult } from '../filesystem/item-operation-contracts'
import { handleError } from '../errors/handle-error'
import { getSearchDialogModel } from './dialog-model'
import type { SearchDisplayItem } from './dialog-model'

export interface SearchDialogActions {
  createItem: (input: {
    name?: string
    parentId: SidebarItemId | null
    type: ResourceKind
  }) => MaybePromise<FileSystemCreateItemResult>
  openItem: WorkspaceNavigation['openItem']
}

export interface SearchDialogRequestState {
  close: () => void
  debouncedQuery: string
  isOpen: boolean
  open: () => void
  query: string
  setQuery: (query: string) => void
  showPreview: boolean
  togglePreview: () => void
}

export interface SearchDialogController {
  close: () => void
  displayItems: Array<SearchDisplayItem>
  emptyStateMessage?: string
  handleKeyDown: (e: React.KeyboardEvent) => void
  handleOpenChange: (newOpen: boolean) => void
  hasQuery: boolean
  inlineStatusMessage?: string
  isOpen: boolean
  openResult: (result: ItemSearchResult) => void
  query: string
  searchQuery: string
  selectedCommand?: SidebarItemCreationCommand
  selectedIndex: number
  selectedItemRef: RefObject<HTMLDivElement | null>
  selectedResult?: ItemSearchResult
  selectDisplayItem: (displayItem: SearchDisplayItem) => void
  setQuery: (query: string) => void
  setSelectedIndex: (index: number) => void
  showPreview: boolean
  status: string
  togglePreview: () => void
}

export function useSearchDialogController({
  actions,
  request,
  searchState,
}: {
  actions: SearchDialogActions
  request: SearchDialogRequestState
  searchState: ItemSearchState
}): SearchDialogController {
  const { close, debouncedQuery, isOpen, query, setQuery, showPreview, togglePreview } = request
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedItemRef = useRef<HTMLDivElement>(null)
  const runningCommandIdRef = useRef<SidebarItemCreationCommand['id'] | null>(null)
  const itemOpenPendingRef = useRef(false)

  const { displayItems, emptyStateMessage, hasQuery, inlineStatusMessage, status } =
    getSearchDialogModel({
      query: debouncedQuery,
      results: searchState.results,
      bodySearchPending: searchState.bodySearchPending,
      bodySearchError: searchState.bodySearchError,
      recentItems: searchState.recentItems,
    })

  const prevQueryRef = useRef(debouncedQuery)
  const maxSelectedIndex = Math.max(displayItems.length - 1, 0)

  useEffect(() => {
    if (prevQueryRef.current !== debouncedQuery) {
      prevQueryRef.current = debouncedQuery
      setSelectedIndex(0)
      return
    }

    setSelectedIndex((index) => Math.min(index, maxSelectedIndex))
  }, [debouncedQuery, maxSelectedIndex])

  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const selectedDisplayItem = displayItems[selectedIndex]
  const selectedResult: ItemSearchResult | undefined =
    selectedDisplayItem?.kind === 'item' ? selectedDisplayItem.result : undefined
  const selectedCommand: SidebarItemCreationCommand | undefined =
    selectedDisplayItem?.kind === 'command' ? selectedDisplayItem.command : undefined

  const handleSelect = (result: ItemSearchResult) => {
    if (itemOpenPendingRef.current) return
    itemOpenPendingRef.current = true
    void (async () => {
      try {
        await actions.openItem(result.resource)
        itemOpenPendingRef.current = false
        close()
      } catch (error) {
        itemOpenPendingRef.current = false
        handleError(error, 'Failed to open item')
      }
    })()
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
        const result = await actions.createItem({
          name: command.defaultName,
          type: command.type,
          parentId: null,
        })
        if (result.status === 'completed') close()
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

  return {
    close,
    displayItems,
    emptyStateMessage,
    handleKeyDown,
    handleOpenChange,
    hasQuery,
    inlineStatusMessage,
    isOpen,
    openResult: handleSelect,
    query,
    searchQuery: debouncedQuery,
    selectedCommand,
    selectedIndex,
    selectedItemRef,
    selectedResult,
    selectDisplayItem: handleSelectDisplayItem,
    setQuery,
    setSelectedIndex,
    showPreview,
    status,
    togglePreview,
  }
}
