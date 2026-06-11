import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SORT_OPTIONS } from 'shared/editor/types'
import type { ReactNode } from 'react'
import { useItemSelectionInteractions } from '../useItemSelectionInteractions'
import type { ItemSelectionModifierState } from '~/features/sidebar/utils/item-selection-intent'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { SidebarWorkspaceSourceProvider } from '~/features/sidebar/workspace/sidebar-workspace-source'
import type { SidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import { resetSidebarUIStore } from '~/test/helpers/store-helpers'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'

beforeEach(() => {
  resetSidebarUIStore()
})

function clickEvent(
  modifiers: Partial<ItemSelectionModifierState> = {},
): ItemSelectionModifierState & { preventDefault: () => void; currentTarget: HTMLElement } {
  return {
    shiftKey: modifiers.shiftKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    preventDefault: () => undefined,
    currentTarget: document.createElement('button'),
  }
}

describe('useItemSelectionInteractions', () => {
  it('optimistically marks a plain-clicked item as viewed before open navigation finishes', () => {
    const item = createNote({ slug: 'target-note' })
    const onOpen = vi.fn()
    const { result } = renderHook(
      () =>
        useItemSelectionInteractions(item, {
          surface: 'sidebar',
          parentId: null,
          visibleItemIds: [item._id],
        }),
      { wrapper },
    )

    act(() => {
      result.current.handleItemClick(clickEvent(), onOpen)
    })

    expect(useSidebarUIStore.getState().selectedSlug).toBe(item.slug)
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([item._id])
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('does not update the viewed slug for range selection clicks', () => {
    const first = createNote({ slug: 'first-note' })
    const second = createNote({ slug: 'second-note' })
    useSidebarUIStore.getState().setSelected(first.slug)
    useSidebarUIStore.getState().selectSingleItem(first._id)
    const { result } = renderHook(
      () =>
        useItemSelectionInteractions(second, {
          surface: 'sidebar',
          parentId: null,
          visibleItemIds: [first._id, second._id],
        }),
      { wrapper },
    )

    act(() => {
      result.current.handleItemClick(clickEvent({ shiftKey: true }))
    })

    expect(useSidebarUIStore.getState().selectedSlug).toBe(first.slug)
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([first._id, second._id])
  })

  it('does not update the viewed slug for toggle selection clicks', () => {
    const first = createNote({ slug: 'first-note' })
    const second = createNote({ slug: 'second-note' })
    useSidebarUIStore.getState().setSelected(first.slug)
    const { result } = renderHook(
      () =>
        useItemSelectionInteractions(second, {
          surface: 'sidebar',
          parentId: null,
          visibleItemIds: [first._id, second._id],
        }),
      { wrapper },
    )

    act(() => {
      result.current.handleItemClick(clickEvent({ ctrlKey: true }))
    })

    expect(useSidebarUIStore.getState().selectedSlug).toBe(first.slug)
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([second._id])
  })

  it('does not update the viewed slug for meta-key toggle selection clicks', () => {
    const first = createNote({ slug: 'first-note' })
    const second = createNote({ slug: 'second-note' })
    useSidebarUIStore.getState().setSelected(first.slug)
    const { result } = renderHook(
      () =>
        useItemSelectionInteractions(second, {
          surface: 'sidebar',
          parentId: null,
          visibleItemIds: [first._id, second._id],
        }),
      { wrapper },
    )

    act(() => {
      result.current.handleItemClick(clickEvent({ metaKey: true }))
    })

    expect(useSidebarUIStore.getState().selectedSlug).toBe(first.slug)
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([second._id])
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
  const emptyItems = {
    data: [],
    status: 'success' as const,
    error: null,
    refetch: vi.fn(),
    ...buildSidebarItemMaps([]),
  }

  return {
    items: { active: emptyItems, trash: emptyItems },
    filteredActiveItems: emptyItems,
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
