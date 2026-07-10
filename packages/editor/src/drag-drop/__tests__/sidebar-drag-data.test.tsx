import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { DEFAULT_SORT_OPTIONS } from '../../workspace/items-persistence-contract'
import type { AnyItem } from '../../workspace/items'
import type { ReactNode } from 'react'
import { createSidebarDragDataSource, useSidebarDragData } from '../sidebar-drag-data'
import { SidebarWorkspaceStateProvider } from '../../workspace/sidebar/workspace-state'
import type { SidebarWorkspaceState } from '../../workspace/sidebar/workspace-state'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { createTestWorkspaceRuntime } from '../../test/workspace-runtime-factory'

let activeSidebarItems: Array<AnyItem> = []
let trashedSidebarItems: Array<AnyItem> = []
let selectionState: SidebarWorkspaceState['selection'] = createSelectionState()

function mockSidebarItems(activeItems: Array<AnyItem>, trashedItems: Array<AnyItem> = []) {
  activeSidebarItems = activeItems
  trashedSidebarItems = trashedItems
}

function setActiveSurface(visibleItems: Array<AnyItem>, surface = 'sidebar' as const) {
  selectionState = {
    ...selectionState,
    activeItemSurface: {
      surface,
      parentId: null,
      visibleItemIds: visibleItems.map((item) => item.id),
    },
  }
}

function setSelectedItemIds(selectedItemIds: Array<AnyItem['id']>) {
  selectionState = {
    ...selectionState,
    selectedItemIds,
    focusedItemId: selectedItemIds[0] ?? null,
  }
}

describe('useSidebarDragData', () => {
  beforeEach(() => {
    selectionState = createSelectionState()
    activeSidebarItems = []
    trashedSidebarItems = []
  })

  it('uses only the current item when no items are selected', () => {
    const note = createNote()
    mockSidebarItems([note])

    const { result } = renderHook(() => useSidebarDragData(note, createDragDataSource()), {
      wrapper,
    })

    expect(result.current).toEqual({
      sidebarItemId: note.id,
      sidebarItemIds: [note.id],
      dragPreviewItemIds: [note.id],
    })
  })

  it('keeps single-item selections unchanged', () => {
    const note = createNote()
    mockSidebarItems([note])
    setSelectedItemIds([note.id])

    const { result } = renderHook(() => useSidebarDragData(note, createDragDataSource()), {
      wrapper,
    })

    expect(result.current).toEqual({
      sidebarItemId: note.id,
      sidebarItemIds: [note.id],
      dragPreviewItemIds: [note.id],
    })
  })

  it('uses only the current item when dragging outside the current selection', () => {
    const dragged = createNote()
    const selected = createNote()
    mockSidebarItems([dragged, selected])
    setSelectedItemIds([selected.id])

    const { result } = renderHook(() => useSidebarDragData(dragged, createDragDataSource()), {
      wrapper,
    })

    expect(result.current).toEqual({
      sidebarItemId: dragged.id,
      sidebarItemIds: [dragged.id],
      dragPreviewItemIds: [dragged.id],
    })
  })

  it('keeps unrelated selected items as separate operation ids', () => {
    const first = createNote()
    const second = createNote()
    mockSidebarItems([first, second])
    setActiveSurface([first, second])
    setSelectedItemIds([first.id, second.id])

    const { result } = renderHook(() => useSidebarDragData(first, createDragDataSource()), {
      wrapper,
    })

    expect(result.current).toEqual({
      sidebarItemId: first.id,
      sidebarItemIds: [first.id, second.id],
      dragPreviewItemIds: [first.id, second.id],
    })
  })

  it('keeps operation ids normalized while exposing raw selected ids for the overlay', () => {
    const folder = createFolder()
    const firstChild = createNote({ parentId: folder.id })
    const secondChild = createNote({ parentId: folder.id })
    const activeItems = [folder, firstChild, secondChild]

    mockSidebarItems(activeItems)
    setActiveSurface(activeItems)
    setSelectedItemIds([folder.id, firstChild.id, secondChild.id])

    const { result } = renderHook(() => useSidebarDragData(firstChild, createDragDataSource()), {
      wrapper,
    })

    expect(result.current).toEqual({
      sidebarItemId: firstChild.id,
      sidebarItemIds: [folder.id],
      dragPreviewItemIds: [folder.id, firstChild.id, secondChild.id],
    })
  })

  it('keeps selected children as separate drag ids when their parent is not selected', () => {
    const folder = createFolder()
    const firstChild = createNote({ parentId: folder.id })
    const secondChild = createNote({ parentId: folder.id })

    mockSidebarItems([folder, firstChild, secondChild])
    setActiveSurface([folder, firstChild, secondChild])
    setSelectedItemIds([firstChild.id, secondChild.id])

    const { result } = renderHook(() => useSidebarDragData(firstChild, createDragDataSource()), {
      wrapper,
    })

    expect(result.current).toEqual({
      sidebarItemId: firstChild.id,
      sidebarItemIds: [firstChild.id, secondChild.id],
      dragPreviewItemIds: [firstChild.id, secondChild.id],
    })
  })

  it('does not include selected items from another surface', () => {
    const active = createNote()
    const trashed = createNote({ status: 'trashed' })
    mockSidebarItems([active], [trashed])
    setActiveSurface([active])
    setSelectedItemIds([active.id, trashed.id])

    const { result } = renderHook(() => useSidebarDragData(active, createDragDataSource()), {
      wrapper,
    })

    expect(result.current).toEqual({
      sidebarItemId: active.id,
      sidebarItemIds: [active.id],
      dragPreviewItemIds: [active.id],
    })
  })

  it('prunes stale selected ids when building drag data', () => {
    const active = createNote()
    const missing = createNote()
    mockSidebarItems([active])
    setActiveSurface([active])
    setSelectedItemIds([active.id, missing.id])

    const { result } = renderHook(() => useSidebarDragData(active, createDragDataSource()), {
      wrapper,
    })

    expect(result.current).toEqual({
      sidebarItemId: active.id,
      sidebarItemIds: [active.id],
      dragPreviewItemIds: [active.id],
    })
  })

  it('keeps known selected ids when stale selected ids are present', () => {
    const first = createNote()
    const second = createNote()
    const missing = createNote()
    mockSidebarItems([first, second])
    setActiveSurface([first, second])
    setSelectedItemIds([first.id, missing.id, second.id])

    const { result } = renderHook(() => useSidebarDragData(first, createDragDataSource()), {
      wrapper,
    })

    expect(result.current).toEqual({
      sidebarItemId: first.id,
      sidebarItemIds: [first.id, second.id],
      dragPreviewItemIds: [first.id, second.id],
    })
  })

  it('keeps drag data identity stable when the inputs do not change', () => {
    const note = createNote()
    mockSidebarItems([note])
    const source = createDragDataSource()

    const { result, rerender } = renderHook(() => useSidebarDragData(note, source), {
      wrapper,
    })
    const initial = result.current

    rerender()

    expect(result.current).toBe(initial)
  })
})

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SidebarWorkspaceStateProvider value={sidebarWorkspaceSourceFromStore()}>
      {children}
    </SidebarWorkspaceStateProvider>
  )
}

function createDragDataSource() {
  const runtime = createTestWorkspaceRuntime({
    activeItems: activeSidebarItems,
    trashItems: trashedSidebarItems,
  })
  return createSidebarDragDataSource({
    catalog: runtime.filesystem.catalog,
    operationItems: runtime.filesystem.operationItems,
  })
}

function createSelectionState(): SidebarWorkspaceState['selection'] {
  return {
    selectedItemIds: [],
    focusedItemId: null,
    activeItemSurface: null,
  }
}

function sidebarWorkspaceSourceFromStore(): SidebarWorkspaceState {
  return {
    ui: {
      folderStates: {},
      closeAllFoldersMode: false,
      bookmarksOnlyMode: false,
    },
    uiCommands: {
      setFolderState: vi.fn(),
      toggleFolderState: vi.fn(),
      clearAllFolderStates: vi.fn(),
      toggleCloseAllFoldersMode: vi.fn(),
      exitCloseAllMode: vi.fn(),
      toggleBookmarksOnlyMode: vi.fn(),
    },
    sort: {
      options: DEFAULT_SORT_OPTIONS,
      setOptions: vi.fn(),
    },
    editing: {
      renamingItemId: null,
      setRenamingItemId: vi.fn(),
    },
    selection: {
      selectedItemIds: selectionState.selectedItemIds,
      focusedItemId: selectionState.focusedItemId,
      activeItemSurface: selectionState.activeItemSurface,
    },
    selectionCommands: {
      setSelectedItemIds: (selectedItemIds) => setSelectedItemIds([...selectedItemIds]),
      selectSingleItem: (id) => setSelectedItemIds([id]),
      toggleItemSelection: vi.fn(),
      selectItemRange: vi.fn(),
      setFocusedItem: (focusedItemId) => {
        selectionState = { ...selectionState, focusedItemId }
      },
      moveFocus: vi.fn(),
      clearItemSelection: () => setSelectedItemIds([]),
      normalizeContextSelection: vi.fn(),
      setActiveItemSurface: (activeItemSurface) => {
        selectionState = { ...selectionState, activeItemSurface }
      },
      clearSelectionForWorkspaceChange: () => {
        selectionState = {
          ...selectionState,
          selectedItemIds: [],
          focusedItemId: null,
          activeItemSurface: null,
        }
      },
      getSelectionSnapshot: () => {
        return {
          selectedItemIds: selectionState.selectedItemIds,
          anchorItemId: selectionState.selectedItemIds[0] ?? null,
          focusedItemId: selectionState.focusedItemId,
          activeItemSurface: selectionState.activeItemSurface,
        }
      },
    },
  }
}
