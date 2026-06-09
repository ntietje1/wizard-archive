import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SORT_OPTIONS } from 'shared/editor/types'
import type { ReactNode } from 'react'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { useSidebarDragData } from '~/features/dnd/hooks/useSidebarDragData'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { SidebarWorkspaceSourceProvider } from '~/features/sidebar/workspace/sidebar-workspace-source'
import type { SidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { resetSidebarUIStore } from '~/test/helpers/store-helpers'

let activeSidebarItems: Array<AnySidebarItem> = []
let trashedSidebarItems: Array<AnySidebarItem> = []

function sidebarItemsValue(items: Array<AnySidebarItem>) {
  return {
    data: items,
    status: 'success' as const,
    error: null,
    refetch: vi.fn(),
    ...buildSidebarItemMaps(items),
  }
}

function mockSidebarItems(
  activeItems: Array<AnySidebarItem>,
  trashedItems: Array<AnySidebarItem> = [],
) {
  activeSidebarItems = activeItems
  trashedSidebarItems = trashedItems
}

function setActiveSurface(visibleItems: Array<AnySidebarItem>, surface = 'sidebar' as const) {
  useSidebarUIStore.getState().setActiveItemSurface({
    surface,
    parentId: null,
    visibleItemIds: visibleItems.map((item) => item._id),
  })
}

describe('useSidebarDragData', () => {
  beforeEach(() => {
    resetSidebarUIStore()
    activeSidebarItems = []
    trashedSidebarItems = []
  })

  it('uses only the current item when no items are selected', () => {
    const note = createNote()
    mockSidebarItems([note])

    const { result } = renderHook(() => useSidebarDragData(note), { wrapper })

    expect(result.current).toEqual({
      sidebarItemId: note._id,
      sidebarItemIds: [note._id],
      sidebarDragPreviewItemIds: [note._id],
    })
  })

  it('keeps single-item selections unchanged', () => {
    const note = createNote()
    mockSidebarItems([note])
    useSidebarUIStore.setState({ selectedItemIds: [note._id] })

    const { result } = renderHook(() => useSidebarDragData(note), { wrapper })

    expect(result.current).toEqual({
      sidebarItemId: note._id,
      sidebarItemIds: [note._id],
      sidebarDragPreviewItemIds: [note._id],
    })
  })

  it('uses only the current item when dragging outside the current selection', () => {
    const dragged = createNote()
    const selected = createNote()
    mockSidebarItems([dragged, selected])
    useSidebarUIStore.setState({ selectedItemIds: [selected._id] })

    const { result } = renderHook(() => useSidebarDragData(dragged), { wrapper })

    expect(result.current).toEqual({
      sidebarItemId: dragged._id,
      sidebarItemIds: [dragged._id],
      sidebarDragPreviewItemIds: [dragged._id],
    })
  })

  it('keeps unrelated selected items as separate operation ids', () => {
    const first = createNote()
    const second = createNote()
    mockSidebarItems([first, second])
    setActiveSurface([first, second])
    useSidebarUIStore.setState({ selectedItemIds: [first._id, second._id] })

    const { result } = renderHook(() => useSidebarDragData(first), { wrapper })

    expect(result.current).toEqual({
      sidebarItemId: first._id,
      sidebarItemIds: [first._id, second._id],
      sidebarDragPreviewItemIds: [first._id, second._id],
    })
  })

  it('keeps operation ids normalized while exposing raw selected ids for the overlay', () => {
    const folder = createFolder()
    const firstChild = createNote({ parentId: folder._id })
    const secondChild = createNote({ parentId: folder._id })
    const activeItems = [folder, firstChild, secondChild]

    mockSidebarItems(activeItems)
    setActiveSurface(activeItems)
    useSidebarUIStore.setState({
      selectedItemIds: [folder._id, firstChild._id, secondChild._id],
    })

    const { result } = renderHook(() => useSidebarDragData(firstChild), { wrapper })

    expect(result.current).toEqual({
      sidebarItemId: firstChild._id,
      sidebarItemIds: [folder._id],
      sidebarDragPreviewItemIds: [folder._id, firstChild._id, secondChild._id],
    })
  })

  it('keeps selected children as separate drag ids when their parent is not selected', () => {
    const folder = createFolder()
    const firstChild = createNote({ parentId: folder._id })
    const secondChild = createNote({ parentId: folder._id })

    mockSidebarItems([folder, firstChild, secondChild])
    setActiveSurface([folder, firstChild, secondChild])
    useSidebarUIStore.setState({
      selectedItemIds: [firstChild._id, secondChild._id],
    })

    const { result } = renderHook(() => useSidebarDragData(firstChild), { wrapper })

    expect(result.current).toEqual({
      sidebarItemId: firstChild._id,
      sidebarItemIds: [firstChild._id, secondChild._id],
      sidebarDragPreviewItemIds: [firstChild._id, secondChild._id],
    })
  })

  it('does not include selected items from another surface', () => {
    const active = createNote()
    const trashed = createNote({ status: 'trashed' })
    mockSidebarItems([active], [trashed])
    setActiveSurface([active])
    useSidebarUIStore.setState({ selectedItemIds: [active._id, trashed._id] })

    const { result } = renderHook(() => useSidebarDragData(active), { wrapper })

    expect(result.current).toEqual({
      sidebarItemId: active._id,
      sidebarItemIds: [active._id],
      sidebarDragPreviewItemIds: [active._id],
    })
  })

  it('prunes stale selected ids when building drag data', () => {
    const active = createNote()
    const missing = createNote()
    mockSidebarItems([active])
    setActiveSurface([active])
    useSidebarUIStore.setState({ selectedItemIds: [active._id, missing._id] })

    const { result } = renderHook(() => useSidebarDragData(active), { wrapper })

    expect(result.current).toEqual({
      sidebarItemId: active._id,
      sidebarItemIds: [active._id],
      sidebarDragPreviewItemIds: [active._id],
    })
  })
})

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SidebarWorkspaceSourceProvider value={sidebarWorkspaceSourceFromStore()}>
      {children}
    </SidebarWorkspaceSourceProvider>
  )
}

function sidebarWorkspaceSourceFromStore(): SidebarWorkspaceSource {
  const state = useSidebarUIStore.getState()
  const active = sidebarItemsValue(activeSidebarItems)
  const trash = sidebarItemsValue(trashedSidebarItems)

  return {
    items: { active, trash },
    filteredActiveItems: active,
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
    commands: {
      createSidebarItem: vi.fn(),
      openItem: vi.fn(),
      openParentFolders: vi.fn(),
      setRenamingItemId: vi.fn(),
    },
    sort: {
      options: DEFAULT_SORT_OPTIONS,
      setOptions: vi.fn(),
    },
    editing: {
      renamingItemId: null,
    },
    selection: {
      selectedSlug: state.selectedSlug,
      selectedItemIds: state.selectedItemIds,
      focusedItemId: state.focusedItemId,
      activeItemSurface: state.activeItemSurface,
    },
    selectionCommands: {
      setSelected: state.setSelected,
      setSelectedItemIds: state.setSelectedItemIds,
      selectSingleItem: state.selectSingleItem,
      toggleItemSelection: state.toggleItemSelection,
      selectItemRange: state.selectItemRange,
      setFocusedItem: state.setFocusedItem,
      moveFocus: state.moveFocus,
      clearItemSelection: state.clearItemSelection,
      normalizeContextSelection: state.normalizeContextSelection,
      setActiveItemSurface: state.setActiveItemSurface,
      getSelectionSnapshot: () => {
        const currentState = useSidebarUIStore.getState()
        return {
          selectedSlug: currentState.selectedSlug,
          selectedItemIds: currentState.selectedItemIds,
          focusedItemId: currentState.focusedItemId,
          activeItemSurface: currentState.activeItemSurface,
        }
      },
    },
  }
}
