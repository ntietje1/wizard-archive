import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useItemSurfaceRegistration } from '../useItemSurfaceRegistration'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import type { ItemSurface } from '~/features/sidebar/stores/sidebar-ui-store'
import { resetSidebarUIStore } from '~/test/helpers/store-helpers'
import { testId } from '~/test/helpers/test-id'

beforeEach(() => {
  resetSidebarUIStore()
})

describe('useItemSurfaceRegistration', () => {
  it('does not re-register a surface when visible ids have the same contents', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    let storeUpdates = 0
    const unsubscribe = useSidebarUIStore.subscribe(() => {
      storeUpdates += 1
    })

    expect(storeUpdates).toBe(0)

    const { rerender, unmount } = renderHook(
      ({ visibleItemIds }) =>
        useItemSurfaceRegistration({
          surface: 'trash',
          parentId: null,
          visibleItemIds,
        }),
      { initialProps: { visibleItemIds: [noteId] } },
    )

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

  it('updates the registered surface when visible ids change', () => {
    const first = testId<'sidebarItems'>('note_1')
    const second = testId<'sidebarItems'>('note_2')
    let storeUpdates = 0
    const unsubscribe = useSidebarUIStore.subscribe(() => {
      storeUpdates += 1
    })

    const { rerender, unmount } = renderHook(
      ({ visibleItemIds }) =>
        useItemSurfaceRegistration({
          surface: 'trash',
          parentId: null,
          visibleItemIds,
        }),
      { initialProps: { visibleItemIds: [first] } },
    )
    const updatesAfterMount = storeUpdates

    rerender({ visibleItemIds: [first, second] })

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

  it('updates the registered surface when surface identity changes', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    const folderId = testId<'sidebarItems'>('folder_1')
    let storeUpdates = 0
    const unsubscribe = useSidebarUIStore.subscribe(() => {
      storeUpdates += 1
    })

    const { rerender, unmount } = renderHook(
      ({ surface, parentId }) =>
        useItemSurfaceRegistration({
          surface,
          parentId,
          visibleItemIds: [noteId],
        }),
      {
        initialProps: {
          surface: 'sidebar' as ItemSurface,
          parentId: null as typeof folderId | null,
        },
      },
    )
    const updatesAfterMount = storeUpdates

    rerender({ surface: 'folder-view', parentId: folderId })

    expect(storeUpdates).toBe(updatesAfterMount + 1)
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'folder-view',
      parentId: folderId,
      visibleItemIds: [noteId],
    })

    unmount()
    expect(useSidebarUIStore.getState().activeItemSurface).toBeNull()
    unsubscribe()
  })
})
