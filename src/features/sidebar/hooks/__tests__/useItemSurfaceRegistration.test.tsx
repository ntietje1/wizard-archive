import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SORT_OPTIONS } from 'shared/editor/types'
import type { ReactNode } from 'react'
import { useItemSurfaceRegistration } from '../useItemSurfaceRegistration'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { SidebarWorkspaceSourceProvider } from '~/features/sidebar/workspace/sidebar-workspace-source'
import type { SidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { resetSidebarUIStore } from '~/test/helpers/store-helpers'
import { testId } from '~/test/helpers/test-id'

beforeEach(() => {
  resetSidebarUIStore()
})

describe('useItemSurfaceRegistration', () => {
  it('does not activate a surface on mount', () => {
    const noteId = testId<'sidebarItems'>('note_1')

    const { result, unmount } = renderHook(
      () =>
        useItemSurfaceRegistration({
          surface: 'trash',
          parentId: null,
          visibleItemIds: [noteId],
        }),
      { wrapper },
    )

    expect(useSidebarUIStore.getState().activeItemSurface).toBeNull()

    result.current.activateSurface()
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'trash',
      parentId: null,
      visibleItemIds: [noteId],
    })

    unmount()
    expect(useSidebarUIStore.getState().activeItemSurface).toBeNull()
  })

  it('does not re-register an active surface when visible ids have the same contents', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    let storeUpdates = 0
    const unsubscribe = useSidebarUIStore.subscribe(() => {
      storeUpdates += 1
    })

    expect(storeUpdates).toBe(0)

    const { result, rerender, unmount } = renderHook(
      ({ visibleItemIds }) =>
        useItemSurfaceRegistration({
          surface: 'trash',
          parentId: null,
          visibleItemIds,
        }),
      { initialProps: { visibleItemIds: [noteId] }, wrapper },
    )

    result.current.activateSurface()
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'trash',
      parentId: null,
      visibleItemIds: [noteId],
    })
    const updatesAfterMount = storeUpdates

    rerender({ visibleItemIds: [noteId] })

    expect(storeUpdates).toBe(updatesAfterMount)
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'trash',
      parentId: null,
      visibleItemIds: [noteId],
    })

    unmount()
    expect(useSidebarUIStore.getState().activeItemSurface).toBeNull()
    unsubscribe()
  })

  it('updates the active surface when visible ids change', () => {
    const first = testId<'sidebarItems'>('note_1')
    const second = testId<'sidebarItems'>('note_2')
    let storeUpdates = 0
    const unsubscribe = useSidebarUIStore.subscribe(() => {
      storeUpdates += 1
    })

    const { result, rerender, unmount } = renderHook(
      ({ visibleItemIds }) =>
        useItemSurfaceRegistration({
          surface: 'trash',
          parentId: null,
          visibleItemIds,
        }),
      { initialProps: { visibleItemIds: [first] }, wrapper },
    )
    result.current.activateSurface()
    const updatesAfterMount = storeUpdates

    rerender({ visibleItemIds: [first, second] })

    // visibleItemIds changes should produce exactly one store update beyond updatesAfterMount.
    expect(storeUpdates).toBe(updatesAfterMount + 1)
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'trash',
      parentId: null,
      visibleItemIds: [first, second],
    })

    unmount()
    expect(useSidebarUIStore.getState().activeItemSurface).toBeNull()
    unsubscribe()
  })

  it('does not let a newly mounted surface steal active ownership', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    const folderId = testId<'sidebarItems'>('folder_1')
    let storeUpdates = 0
    const unsubscribe = useSidebarUIStore.subscribe(() => {
      storeUpdates += 1
    })

    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [noteId],
    })

    const { unmount } = renderHook(
      () =>
        useItemSurfaceRegistration({
          surface: 'folder-view',
          parentId: folderId,
          visibleItemIds: [noteId],
        }),
      { wrapper },
    )

    // Mounting registers metadata only; focus/pointer interaction is what transfers ownership.
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [noteId],
    })

    unmount()
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [noteId],
    })
    unsubscribe()
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
      setFolderState: () => undefined,
      toggleFolderState: () => undefined,
      clearAllFolderStates: () => undefined,
      toggleCloseAllFoldersMode: () => undefined,
      exitCloseAllMode: () => undefined,
      toggleBookmarksOnlyMode: () => undefined,
    },
    commands: {
      openParentFolders: () => undefined,
      setRenamingItemId: () => undefined,
    },
    sort: {
      options: DEFAULT_SORT_OPTIONS,
      setOptions: () => undefined,
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
